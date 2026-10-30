import type { Feature, FeatureCollection, Geometry, MultiLineString, Position } from 'geojson'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import Globe, { type GlobeMethods } from 'react-globe.gl'
import { BufferGeometry, CanvasTexture, Color, DoubleSide, Float32BufferAttribute, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, MeshPhongMaterial, Raycaster, SRGBColorSpace, Sphere, Vector2, Vector3 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import ConicPolygonGeometry from 'three-conic-polygon-geometry'
import { feature, mesh } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import atlasUrl from 'world-atlas/countries-110m.json?url'
import { BY_ID, BY_NUM, COUNTRY_BY_ISO } from '../../data/countries'
import subdivisionsUrl from '../../data/geo/subdivisions.json?url'
import { HOME_COLOR, TARGET_COLOR } from '../../lib/colors'

export interface PolyStyle {
  cap: string
  side: string
  stroke: string
  alt: number
}

type BBox = [number, number, number, number]
/** `dest` is the destination id (ISO2, or ISO 3166-2 for states/provinces/cantons) when we have data for it. */
export type GeoFeature = Feature<Geometry, { name: string }> & { dest?: string; bbox: BBox }

interface Atlas {
  /** Destinations we have data for — rendered as interactive 3D polygons. Split countries contribute one per subdivision. */
  covered: GeoFeature[]
  /** Everything else — painted into the globe texture (zero draw calls) and hit-tested in JS. */
  uncovered: GeoFeature[]
  /** Every border/coastline once (except inside/around split countries, outlined by their own polygons), as a single LineSegments draw call. */
  borders: Position[][]
}

const OCEAN = '#0b1634'
const LAND = '#16233f'

const ringsOf = (g: Geometry): Position[][][] => (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [])

/**
 * Makes ring longitudes continuous across the antimeridian (e.g. Russia, Fiji: 179° → 181° instead of 179° → −179°),
 * so flat-map painting and point-in-polygon tests don't treat the jump as an edge spanning the whole globe.
 */
function unwrap(g: Geometry) {
  for (const poly of ringsOf(g))
    for (const ring of poly)
      for (let i = 1; i < ring.length; i++) {
        const prev = ring[i - 1][0]
        while (ring[i][0] - prev > 180) ring[i][0] -= 360
        while (prev - ring[i][0] > 180) ring[i][0] += 360
      }
  return g
}

function bboxOf(g: Geometry): BBox {
  const b: BBox = [180, 90, -180, -90]
  for (const poly of ringsOf(g)) for (const [x, y] of poly[0]) (b[0] = Math.min(b[0], x)), (b[1] = Math.min(b[1], y)), (b[2] = Math.max(b[2], x)), (b[3] = Math.max(b[3], y))
  return b
}

const fetchTopo = (url: string) => fetch(url).then((r) => r.json() as Promise<Topology>)
const isSplit = (id: unknown) => !!BY_NUM.get(Number(id))?.subdivisions

let atlasPromise: Promise<Atlas> | undefined
const loadAtlas = () =>
  (atlasPromise ??= Promise.all([fetchTopo(atlasUrl), fetchTopo(subdivisionsUrl)]).then(([topo, subTopo]) => {
    const obj = topo.objects.countries as GeometryCollection<{ name: string }>
    const countries = (feature(topo, obj) as FeatureCollection<Geometry, { name: string }>).features
      .filter((f) => f.geometry && f.properties.name !== 'Antarctica' && !isSplit(f.id))
      .map((f) => Object.assign(f, { dest: BY_NUM.get(Number(f.id))?.iso2, bbox: bboxOf(unwrap(f.geometry)) }))
    const subObj = subTopo.objects.subdivisions as GeometryCollection<{ name: string }>
    const regions = (feature(subTopo, subObj) as FeatureCollection<Geometry, { name: string }>).features.map((f) => {
      const id = String(f.id)
      const dest = BY_ID.has(id) ? id : undefined
      if (!dest) f.properties.name = `${f.properties.name}, ${COUNTRY_BY_ISO.get(id.slice(0, 2))?.name ?? ''}`
      return Object.assign(f, { dest, bbox: bboxOf(unwrap(f.geometry)) })
    })
    const all: GeoFeature[] = [...countries, ...regions]
    return {
      covered: all.filter((f) => f.dest),
      uncovered: all.filter((f) => !f.dest),
      borders: (mesh(topo, obj, (a, b) => !(isSplit(a.id) && isSplit(b.id))) as MultiLineString).coordinates,
    }
  }))

/**
 * Appends a polyline as LINE segments lifted `alt` above the surface. Long edges are subdivided (≤1.5°) so chords
 * don't dip below the curved surface, and antimeridian cut edges (not real borders) are skipped.
 */
function pushSegments(g: GlobeMethods, line: Position[], alt: number, out: number[]) {
  for (let i = 1; i < line.length; i++) {
    const [lng0, lat0] = line[i - 1]
    let [lng1, lat1] = line[i]
    if (Math.abs(lng0) > 179.9 && Math.abs(lng1) > 179.9) continue
    if (lng1 - lng0 > 180) lng1 -= 360 // crossing the antimeridian: interpolate the short way round
    else if (lng0 - lng1 > 180) lng1 += 360
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(lng1 - lng0), Math.abs(lat1 - lat0)) / 1.5))
    let prev = g.getCoords(lat0, lng0, alt)
    for (let s = 1; s <= steps; s++) {
      const t = s / steps
      const next = g.getCoords(lat0 + (lat1 - lat0) * t, lng0 + (lng1 - lng0) * t, alt)
      out.push(prev.x, prev.y, prev.z, next.x, next.y, next.z)
      prev = next
    }
  }
}

function rgba(css: string): [number, number, number, number] {
  const m = css.match(/rgba?\(([^)]+)\)/)
  if (m) {
    const [r, gr, b, a = '1'] = m[1].split(',').map((s) => s.trim())
    return [+r / 255, +gr / 255, +b / 255, +a]
  }
  const c = new Color(css)
  return [c.r, c.g, c.b, 1]
}

/** Even-odd ray casting across all rings of a (multi)polygon in lng/lat space. */
function contains(f: GeoFeature, lng: number, lat: number): boolean {
  const [x0, y0, x1, y1] = f.bbox
  if (lat < y0 || lat > y1) return false
  // Unwrapped rings can extend past ±180°, so also try the point shifted by a full turn.
  if (lng < x0 || lng > x1) return (lng + 360 <= x1 && containsAt(f, lng + 360, lat)) || (lng - 360 >= x0 && containsAt(f, lng - 360, lat))
  return containsAt(f, lng, lat)
}

function containsAt(f: GeoFeature, lng: number, lat: number) {
  let inside = false
  for (const poly of ringsOf(f.geometry))
    for (const ring of poly)
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i]
        const [xj, yj] = ring[j]
        if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
      }
  return inside
}

/** Equirectangular base map: ocean + uncovered land. Covered countries sit on top as polygons. */
function paintBaseTexture(uncovered: GeoFeature[]) {
  const W = 4096
  const H = 2048
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = OCEAN
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = LAND
  for (const f of uncovered) {
    // Features unwrapped past ±180° are painted again one map-width over so both edges of the texture get filled.
    const offsets = [0, ...(f.bbox[0] < -180 ? [W] : []), ...(f.bbox[2] > 180 ? [-W] : [])]
    for (const dx of offsets) {
      ctx.beginPath()
      for (const poly of ringsOf(f.geometry))
        for (const ring of poly) ring.forEach(([lng, lat], i) => ctx[i ? 'lineTo' : 'moveTo'](((lng + 180) / 360) * W + dx, ((90 - lat) / 180) * H))
      ctx.fill('evenodd')
    }
  }
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  return tex
}

const RAISED_ALT = 0.02
const DEFAULT_STYLE: PolyStyle = { cap: 'rgba(45,212,191,0.32)', side: 'rgba(45,212,191,0.12)', stroke: 'rgba(94,234,212,0.55)', alt: 0.012 }

export interface Marker {
  id: string
  lat: number
  lng: number
  color: string
}

export interface Arc {
  startLat: number
  startLng: number
  endLat: number
  endLng: number
}

export interface Label {
  lat: number
  lng: number
  text: string
  color: string
}

interface Props {
  width: number
  height: number
  /** Keyed by destination id. */
  styles: Map<string, PolyStyle>
  hovered: string | null
  hoveredName: string | null
  markers: Marker[]
  arcs: Arc[]
  labels: Label[]
  rotate: boolean
  focus: { lat: number; lng: number; altitude: number; n: number } | null
  onHover: (id: string | null, name: string | null) => void
  onPick: (id: string, x: number, y: number) => void
  onBackground: () => void
}

// Stable references: a new function/array/object identity makes globe.gl re-process the whole layer.
const RENDERER_CONFIG = { antialias: true, alpha: true, powerPreference: 'high-performance' } as const
const NO_FEATURES: GeoFeature[] = []
const polygonGeometry = (d: object) => (d as GeoFeature).geometry as never
const pointColor = (d: object) => (d as Marker).color
const ARC_COLORS = [HOME_COLOR, TARGET_COLOR]
const arcColor = () => ARC_COLORS
const labelColor = (d: object) => (d as Label).color

const pickRay = new Raycaster()
const pickNdc = new Vector2()
const pickHit = new Vector3()
const pickSphere = new Sphere()

/** Pointer → lat/lng via an exact ray/sphere hit. globe.gl's toGlobeCoords raycasts the entire scene to find the globe. */
function pointerToLatLng(g: GlobeMethods, x: number, y: number, size: { w: number; h: number }) {
  pickNdc.set((x / size.w) * 2 - 1, -(y / size.h) * 2 + 1)
  pickRay.setFromCamera(pickNdc, g.camera())
  pickSphere.radius = g.getGlobeRadius()
  const hit = pickRay.ray.intersectSphere(pickSphere, pickHit)
  return hit ? g.toGeoCoords(hit) : null
}

/** A merged geometry plus the vertex range(s) belonging to each destination id. */
interface MergedLayer {
  geom: BufferGeometry
  ranges: Map<string, [number, number][]>
}
const HIDDEN: [number, number, number, number] = [0, 0, 0, 0]
const HOVER_STROKE: [number, number, number, number] = [1, 1, 1, 0.95]

const MAX_PIXEL_RATIO = 2
const MIN_PIXEL_RATIO = 1
const TARGET_FPS = 50

function GlobeCanvas({ width, height, styles, hovered, hoveredName, markers, arcs, labels, rotate, focus, onHover, onPick, onBackground }: Props) {
  const ref = useRef<GlobeMethods | undefined>(undefined)
  const wrap = useRef<HTMLDivElement>(null)
  const material = useMemo(() => new MeshPhongMaterial({ color: OCEAN, emissive: '#040a1c', shininess: 6 }), [])
  const [atlas, setAtlas] = useState<Atlas | null>(null)
  const [merged, setMerged] = useState<{ caps: MergedLayer; outlines: MergedLayer } | null>(null)
  const overMarker = useRef(false)
  const pointer = useRef<{ x: number; y: number } | null>(null)
  const hoverKey = useRef<string | null>(null)
  const pending = useRef(0)
  const latest = useRef({ onHover, atlas, size: { w: width, h: height } })
  latest.current = { onHover, atlas, size: { w: width, h: height } }

  useEffect(() => {
    let cancelled = false
    loadAtlas().then((a) => !cancelled && setAtlas(a))
    const g = ref.current
    if (g) {
      const controls = g.controls()
      // Close enough to pick individual Swiss cantons.
      controls.minDistance = 112
      controls.maxDistance = 520
      controls.autoRotateSpeed = 0.45
      // three.js draws transparent DoubleSide materials in two passes and flags `needsUpdate` twice per object per
      // frame, re-validating shader programs each time. three-globe's polygon materials are all transparent and
      // double-sided; they're thin shells, so a single pass looks identical at half the draw calls.
      // three-render-objects raycasts the whole scene on every pointer move. Countries are picked in JS (lat/lng
      // point-in-polygon), so only markers and the globe (background clicks) need raycasting; everything else opts out.
      const scene = g.scene()
      const prepared = new WeakSet<object>()
      const R = g.getGlobeRadius()
      scene.onBeforeRender = () => {
        for (const layer of scene.children)
          layer.traverse((o) => {
            if (prepared.has(o)) return
            prepared.add(o)
            const mesh = o as Mesh
            const m = mesh.material
            if (Array.isArray(m)) for (const mat of m) if (mat.side === DoubleSide) mat.forceSinglePass = true
            if (mesh.material === material) {
              // The globe is a perfect sphere: answer its raycasts analytically instead of testing ~11k triangles.
              const sphere = new Sphere(new Vector3(), R)
              o.raycast = (raycaster, hits) => {
                const point = raycaster.ray.intersectSphere(sphere, new Vector3())
                if (point) hits.push({ distance: raycaster.ray.origin.distanceTo(point), point, object: o })
              }
            } else if (!(mesh.geometry?.type === 'CylinderGeometry')) o.raycast = () => {} // markers stay pickable
          })
      }
    }
    return () => {
      cancelled = true
    }
  }, [])

  // Base texture + merged borders, built once per atlas load.
  useEffect(() => {
    const g = ref.current
    if (!atlas || !g) return
    const tex = paintBaseTexture(atlas.uncovered)
    tex.anisotropy = g.renderer().capabilities.getMaxAnisotropy()
    material.map = tex
    material.color.set('#ffffff')
    material.needsUpdate = true

    const positions: number[] = []
    for (const line of atlas.borders) pushSegments(g, line, 0.0015, positions)
    const geom = new BufferGeometry()
    geom.setAttribute('position', new Float32BufferAttribute(positions, 3))
    const lines = new LineSegments(geom, new LineBasicMaterial({ color: '#94a3b8', transparent: true, opacity: 0.28, depthWrite: false }))
    lines.raycast = () => {}
    g.scene().add(lines)

    // Outlines of every covered polygon in ONE draw call (per-part strokes were ~half of all draw calls). Colours are
    // per-vertex RGBA so styles and hover can change without rebuilding positions; raised polygons keep their own stroke.
    const outlinePos: number[] = []
    const ranges = new Map<string, [number, number][]>()
    for (const f of atlas.covered) {
      const list: [number, number][] = []
      for (const poly of ringsOf(f.geometry))
        for (const ring of poly) {
          const start = outlinePos.length / 3
          pushSegments(g, ring, DEFAULT_STYLE.alt + 1e-4, outlinePos)
          list.push([start, outlinePos.length / 3])
        }
      ranges.set(f.dest!, list)
    }
    const outlineGeom = new BufferGeometry()
    outlineGeom.setAttribute('position', new Float32BufferAttribute(outlinePos, 3))
    outlineGeom.setAttribute('color', new Float32BufferAttribute(new Float32Array((outlinePos.length / 3) * 4), 4))
    const outlineLines = new LineSegments(outlineGeom, new LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false }))

    // Likewise every covered cap is merged into ONE mesh (three-globe draws one mesh per polygon part — ~250 draw calls).
    // Same geometry generator as three-globe; raised polygons (home/targets) are hidden here and drawn by its layer.
    const R = g.getGlobeRadius()
    const capParts: BufferGeometry[] = []
    const capRanges = new Map<string, [number, number][]>()
    let vertices = 0
    for (const f of atlas.covered) {
      const list: [number, number][] = []
      for (const poly of ringsOf(f.geometry)) {
        const part = new ConicPolygonGeometry(poly, R, R * (1 + DEFAULT_STYLE.alt), false, true, false, 5)
        const n = part.getAttribute('position').count
        list.push([vertices, vertices + n])
        vertices += n
        capParts.push(part)
      }
      capRanges.set(f.dest!, list)
    }
    const capGeom = mergeGeometries(capParts)
    capParts.forEach((p) => p.dispose())
    capGeom.setAttribute('color', new Float32BufferAttribute(new Float32Array(vertices * 4), 4))
    const caps = new Mesh(capGeom, new MeshBasicMaterial({ vertexColors: true, transparent: true, side: DoubleSide, forceSinglePass: true, depthWrite: false }))

    g.scene().add(caps, outlineLines)
    setMerged({ caps: { geom: capGeom, ranges: capRanges }, outlines: { geom: outlineGeom, ranges } })

    return () => {
      g.scene().remove(lines, outlineLines, caps)
      for (const o of [lines, outlineLines, caps]) {
        o.geometry.dispose()
        ;(o.material as LineBasicMaterial).dispose()
      }
      material.map = null
      tex.dispose()
      setMerged(null)
    }
  }, [atlas, material])

  // Recolour the merged caps/outlines. A style change repaints everything; a hover change only the two affected ids.
  const painted = useRef<{ styles: Map<string, PolyStyle> | null; hovered: string | null }>({ styles: null, hovered: null })
  useEffect(() => {
    if (!merged) return
    const prev = painted.current
    const ids = prev.styles === styles ? [prev.hovered, hovered].filter((x): x is string => !!x) : [...merged.caps.ranges.keys()]
    const fill = (layer: MergedLayer, id: string, c: [number, number, number, number]) => {
      const arr = (layer.geom.getAttribute('color') as Float32BufferAttribute).array as Float32Array
      for (const [start, end] of layer.ranges.get(id) ?? []) for (let i = start * 4; i < end * 4; i += 4) (arr[i] = c[0]), (arr[i + 1] = c[1]), (arr[i + 2] = c[2]), (arr[i + 3] = c[3])
    }
    for (const id of ids) {
      const s = styles.get(id) ?? DEFAULT_STYLE
      const raised = s.alt > RAISED_ALT
      const hot = id === hovered
      fill(merged.caps, id, raised ? HIDDEN : rgba(hot ? s.cap.replace(/[\d.]+\)$/, '0.99)') : s.cap))
      fill(merged.outlines, id, raised ? HIDDEN : hot ? HOVER_STROKE : rgba(s.stroke))
    }
    merged.caps.geom.getAttribute('color').needsUpdate = true
    merged.outlines.geom.getAttribute('color').needsUpdate = true
    painted.current = { styles, hovered }
  }, [merged, styles, hovered])

  // Adaptive resolution: start sharp, step the pixel ratio down until we hold ~50fps.
  useEffect(() => {
    const renderer = ref.current?.renderer()
    if (!renderer) return
    let ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO)
    renderer.setPixelRatio(ratio)
    let raf = 0
    let start = 0
    let frames = 0
    const tick = (t: number) => {
      if (document.hidden) {
        start = 0
        frames = 0
      } else if (!start) start = t
      else if (++frames && t - start >= 1500) {
        const fps = (frames * 1000) / (t - start)
        if (fps >= TARGET_FPS || ratio <= MIN_PIXEL_RATIO) return
        ratio = Math.max(MIN_PIXEL_RATIO, ratio - 0.5)
        renderer.setPixelRatio(ratio)
        start = 0
        frames = 0
      }
      raf = requestAnimationFrame(tick)
    }
    const delay = setTimeout(() => (raf = requestAnimationFrame(tick)), 1200)
    return () => {
      clearTimeout(delay)
      cancelAnimationFrame(raf)
    }
  }, [])

  // Stop rendering entirely while the globe is scrolled out of view.
  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? ref.current?.resumeAnimation() : ref.current?.pauseAnimation()))
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    const controls = ref.current?.controls()
    if (controls) controls.autoRotate = rotate && !hovered && !hoveredName
  }, [rotate, hovered, hoveredName])

  useEffect(() => {
    if (focus) ref.current?.pointOfView({ lat: focus.lat, lng: focus.lng, altitude: focus.altitude }, focus.n ? 1200 : 0)
  }, [focus])

  /** Hover = lat/lng under the pointer + point-in-polygon. Far cheaper than raycasting thousands of triangles. */
  const checkHover = () => {
    pending.current = 0
    const { atlas: a, onHover: hover } = latest.current
    const p = pointer.current
    const g = ref.current
    if (overMarker.current) return
    let dest: string | null = null
    let name: string | null = null
    const c = a && p && g ? pointerToLatLng(g, p.x, p.y, latest.current.size) : null
    if (a && c) {
      dest = a.covered.find((f) => contains(f, c.lng, c.lat))?.dest ?? null
      if (!dest) name = a.uncovered.find((f) => contains(f, c.lng, c.lat))?.properties.name ?? null
    }
    const key = dest ?? (name && `name:${name}`)
    if (key !== hoverKey.current) {
      hoverKey.current = key
      hover(dest, name)
    }
  }
  const scheduleCheck = () => {
    if (!pending.current) pending.current = requestAnimationFrame(checkHover)
  }
  const onGlobeClick = ({ lat, lng }: { lat: number; lng: number }, ev: MouseEvent) => {
    const dest = atlas?.covered.find((f) => contains(f, lng, lat))?.dest
    if (dest) onPick(dest, ev.offsetX, ev.offsetY)
    else onBackground()
  }
  // Only raised polygons (home/targets) go through three-globe's layer, for their walls and lift animation.
  const raisedKey = atlas ? atlas.covered.filter((f) => (styles.get(f.dest!)?.alt ?? 0) > RAISED_ALT).map((f) => f.dest).join() : ''
  // Keyed on the id list (not `styles`) so heat-map recolours don't re-digest the layer.
  const raised = useMemo(() => (atlas ? atlas.covered.filter((f) => (styles.get(f.dest!)?.alt ?? 0) > RAISED_ALT) : NO_FEATURES), [atlas, raisedKey])

  // globe.gl re-digests a whole layer whenever one of its accessor props changes identity, so accessors are
  // memoised by what they actually read: hovering only re-digests the (few) raised polygons, never arcs or labels.
  const polygonAccessors = useMemo(() => {
    const styleOf = (d: object) => styles.get((d as GeoFeature).dest!) ?? DEFAULT_STYLE
    const isHover = (d: object) => (d as GeoFeature).dest === hovered
    return {
      // Brighten but stay translucent: flipping material.transparent forces three.js to re-sort and re-validate programs.
      cap: (d: object) => (isHover(d) ? styleOf(d).cap.replace(/[\d.]+\)$/, '0.99)') : styleOf(d).cap),
      side: (d: object) => styleOf(d).side,
      stroke: (d: object) => (isHover(d) ? 'rgba(255,255,255,0.95)' : styleOf(d).stroke),
      altitude: (d: object) => styleOf(d).alt + (isHover(d) ? 0.02 : 0),
    }
  }, [styles, hovered])
  const pointAltitude = useMemo(() => (d: object) => ((d as Marker).id === hovered ? 0.06 : 0.035), [hovered])

  return (
    <div
      ref={wrap}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        pointer.current = { x: e.clientX - r.left, y: e.clientY - r.top }
        scheduleCheck()
      }}
      onPointerLeave={() => {
        pointer.current = null
        hoverKey.current = null
      }}
    >
      <Globe
        ref={ref}
        width={width}
        height={height}
        rendererConfig={RENDERER_CONFIG}
        backgroundColor="rgba(0,0,0,0)"
        globeMaterial={material}
        showAtmosphere
        atmosphereColor="#38bdf8"
        atmosphereAltitude={0.16}
        onGlobeClick={onGlobeClick}
        polygonsData={raised}
        polygonGeoJsonGeometry={polygonGeometry}
        polygonCapColor={polygonAccessors.cap}
        polygonSideColor={polygonAccessors.side}
        polygonStrokeColor={polygonAccessors.stroke}
        polygonAltitude={polygonAccessors.altitude}
        polygonsTransitionDuration={200}
        pointsData={markers}
        pointLat="lat"
        pointLng="lng"
        pointColor={pointColor}
        pointAltitude={pointAltitude}
        pointRadius={0.32}
        pointResolution={12}
        pointsTransitionDuration={200}
        onPointHover={(d) => {
          const m = d as Marker | null
          overMarker.current = !!m
          hoverKey.current = m?.id ?? null
          onHover(m?.id ?? null, null)
          if (!m) scheduleCheck()
        }}
        onPointClick={(d, ev) => onPick((d as Marker).id, ev.offsetX, ev.offsetY)}
        arcsData={arcs}
        arcColor={arcColor}
        arcStroke={0.45}
        arcCircularResolution={4}
        arcCurveResolution={48}
        arcDashLength={0.45}
        arcDashGap={0.2}
        arcDashAnimateTime={2600}
        arcAltitudeAutoScale={0.4}
        arcsTransitionDuration={600}
        labelsData={labels}
        labelLat="lat"
        labelLng="lng"
        labelText="text"
        labelColor={labelColor}
        labelSize={1.15}
        labelDotRadius={0.45}
        labelAltitude={0.045}
        labelResolution={2}
        labelsTransitionDuration={300}
      />
    </div>
  )
}

export default memo(GlobeCanvas)
