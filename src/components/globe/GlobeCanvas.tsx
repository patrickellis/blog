import type { Feature, FeatureCollection, Geometry } from 'geojson'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import Globe, { type GlobeMethods } from 'react-globe.gl'
import { MeshPhongMaterial } from 'three'
import { feature } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import atlasUrl from 'world-atlas/countries-50m.json?url'
import { BY_NUM } from '../../data/countries'
import { HOME_COLOR, TARGET_COLOR } from '../../lib/colors'

export interface PolyStyle {
  cap: string
  side: string
  stroke: string
  alt: number
}

export type GeoFeature = Feature<Geometry, { name: string }> & { num: number; iso?: string }

let featuresPromise: Promise<GeoFeature[]> | undefined
const loadFeatures = () =>
  (featuresPromise ??= fetch(atlasUrl)
    .then((r) => r.json() as Promise<Topology>)
    .then((topo) =>
      (feature(topo, topo.objects.countries as GeometryCollection<{ name: string }>) as FeatureCollection<Geometry, { name: string }>).features
        .filter((f) => f.properties.name !== 'Antarctica')
        .map((f) => {
          const num = Number(f.id)
          return Object.assign(f, { num, iso: BY_NUM.get(num)?.iso2 })
        }),
    ))

const DEFAULT_STYLE: PolyStyle = { cap: 'rgba(100,116,139,0.14)', side: 'rgba(15,23,42,0.4)', stroke: 'rgba(148,163,184,0.18)', alt: 0.006 }

export interface Marker {
  iso: string
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
  styles: Map<number, PolyStyle>
  hovered: string | null
  hoveredName: string | null
  markers: Marker[]
  arcs: Arc[]
  labels: Label[]
  rotate: boolean
  focus: { lat: number; lng: number; n: number } | null
  onHover: (iso: string | null, name: string | null) => void
  onPick: (iso: string, x: number, y: number) => void
  onBackground: () => void
}

function GlobeCanvas({ width, height, styles, hovered, hoveredName, markers, arcs, labels, rotate, focus, onHover, onPick, onBackground }: Props) {
  const ref = useRef<GlobeMethods | undefined>(undefined)
  const material = useMemo(() => new MeshPhongMaterial({ color: '#0b1634', emissive: '#040a1c', shininess: 6 }), [])
  const [features, setFeatures] = useState<GeoFeature[]>([])

  useEffect(() => {
    loadFeatures().then(setFeatures)
  }, [])

  useEffect(() => {
    const controls = ref.current?.controls()
    if (!controls) return
    controls.autoRotate = rotate && !hovered && !hoveredName
    controls.autoRotateSpeed = 0.45
  }, [rotate, hovered, hoveredName])

  useEffect(() => {
    if (focus) ref.current?.pointOfView({ lat: focus.lat, lng: focus.lng, altitude: 2 }, 1200)
  }, [focus])

  const styleOf = (f: GeoFeature) => styles.get(f.num) ?? DEFAULT_STYLE
  const isHover = (f: GeoFeature) => (f.iso ? f.iso === hovered : f.properties.name === hoveredName)

  return (
    <Globe
      ref={ref}
      width={width}
      height={height}
      backgroundColor="rgba(0,0,0,0)"
      globeMaterial={material}
      showAtmosphere
      atmosphereColor="#38bdf8"
      atmosphereAltitude={0.16}
      onGlobeReady={() => {
        const controls = ref.current?.controls()
        if (controls) {
          controls.minDistance = 170
          controls.maxDistance = 520
          controls.autoRotate = rotate
          controls.autoRotateSpeed = 0.45
        }
        if (focus) ref.current?.pointOfView({ lat: focus.lat, lng: focus.lng, altitude: 2.1 }, 0)
      }}
      onGlobeClick={onBackground}
      polygonsData={features}
      polygonGeoJsonGeometry={(d) => (d as GeoFeature).geometry as never}
      polygonCapColor={(d) => {
        const f = d as GeoFeature
        const s = styleOf(f)
        return isHover(f) && f.iso ? s.cap.replace(/[\d.]+\)$/, '1)') : s.cap
      }}
      polygonSideColor={(d) => styleOf(d as GeoFeature).side}
      polygonStrokeColor={(d) => (isHover(d as GeoFeature) ? 'rgba(255,255,255,0.95)' : styleOf(d as GeoFeature).stroke)}
      polygonAltitude={(d) => styleOf(d as GeoFeature).alt + (isHover(d as GeoFeature) ? 0.025 : 0)}
      polygonsTransitionDuration={250}
      onPolygonHover={(d) => {
        const f = d as GeoFeature | null
        onHover(f?.iso ?? null, f && !f.iso ? f.properties.name : null)
      }}
      onPolygonClick={(d, ev) => {
        const f = d as GeoFeature
        if (f.iso) onPick(f.iso, ev.offsetX, ev.offsetY)
        else onBackground()
      }}
      pointsData={markers}
      pointLat="lat"
      pointLng="lng"
      pointColor={(d) => (d as Marker).color}
      pointAltitude={(d) => ((d as Marker).iso === hovered ? 0.06 : 0.035)}
      pointRadius={0.32}
      pointResolution={16}
      pointsTransitionDuration={200}
      onPointHover={(d) => onHover((d as Marker | null)?.iso ?? null, null)}
      onPointClick={(d, ev) => onPick((d as Marker).iso, ev.offsetX, ev.offsetY)}
      arcsData={arcs}
      arcColor={() => [HOME_COLOR, TARGET_COLOR]}
      arcStroke={0.45}
      arcDashLength={0.45}
      arcDashGap={0.2}
      arcDashAnimateTime={2600}
      arcAltitudeAutoScale={0.4}
      arcsTransitionDuration={600}
      labelsData={labels}
      labelLat="lat"
      labelLng="lng"
      labelText="text"
      labelColor={(d) => (d as Label).color}
      labelSize={1.15}
      labelDotRadius={0.45}
      labelAltitude={0.045}
      labelResolution={3}
      labelsTransitionDuration={300}
    />
  )
}

export default memo(GlobeCanvas)
