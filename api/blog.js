// SEVCP blog feed, from the "SEVCP CMS" Sanity project (vm3u10aa, SEDC org).
// Edit posts in the Studio (~/Claude/sevcp-studio). Served through this function
// so responses are CDN-cached and the site needs no Sanity client of its own.
// Keep QUERY in sync with serve.py (local dev proxy).

const PROJECT = 'vm3u10aa';
const DATASET = 'production';
const QUERY = `*[_type == "blogPost" && defined(slug.current) && !(_id in path("drafts.**"))]
  | order(publishedAt desc) {
    title, "slug": slug.current, intro, publishedAt,
    "image": mainImage.asset->url,
    "author": author->name,
    "categories": categories[]->title,
    "words": length(string::split(pt::text(body), " ")),
    body[]{..., _type == "image" => {"url": asset->url}}
  }`;

module.exports = async (req, res) => {
  const url = `https://${PROJECT}.apicdn.sanity.io/v2024-01-01/data/query/${DATASET}?query=${encodeURIComponent(QUERY)}`;
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error('Sanity ' + r.status);
    const { result } = await r.json();
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=600');
    res.status(200).json({ posts: result || [] });
  } catch (e) {
    res.status(502).json({ posts: [], error: String(e.message || e) });
  }
};
