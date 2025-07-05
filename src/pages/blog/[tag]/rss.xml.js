import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { SITE_TITLE } from '../../../consts';

export async function GET(context) {
	const { tag } = context.params;
	const posts = await getCollection('blog');
	const filteredPosts = posts.filter((post) => post.data.category === tag);

	return rss({
		title: `${SITE_TITLE} - ${tag}`,
		description: `Posts tagged with ${tag}`,
		site: context.site,
		items: filteredPosts.map((post) => ({
			...post.data,
			link: `/blog/${post.slug}/`,
		})),
	});
}

export async function getStaticPaths() {
	const posts = await getCollection('blog');
	const tags = [...new Set(posts.map((post) => post.data.category).filter(Boolean))];
	return tags.map((tag) => ({
		params: { tag },
	}));
}
