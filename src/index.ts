import { Hono } from 'hono'

const app = new Hono()

import { REGEX as TIKTOK_REGEX, meta as TIKTOK_META, redirect as TIKTOK_REDIRECT } from './providers/tiktok'
import { b64Decode, b64Encode } from './util'

const providers = [
  {
    regex: TIKTOK_REGEX,
    name: 'TikTok',
    meta: TIKTOK_META,
    redirect: TIKTOK_REDIRECT,
  }
]

app.get('/:url{.*}', async (c) => {
  let url: string | URL = c.req.param('url')
  try {
    url = new URL(url)
  } catch (e) {
    return c.text('Invalid URL', 400)
  }

  for (const provider of providers) {
    if (provider.regex.test(url.toString())) {
      if (!c.req.header('User-Agent')?.toLowerCase().includes('bot')) {
        return c.redirect(await provider.redirect(url))
      }

      let meta = await provider.meta(url)

      let description = meta.description.substring(0, 197) + (meta.description.length > 197 ? '...' : '')

      let oembed = {
        ...meta.oembed,
        author_name: description,
        title: provider.name
      }

      const tags = [
        `<meta name="theme-color" content="#8100AB"/>`,

        `<meta property="og:title" content="${meta.title}" />`,
        `<meta property="og:description" content="${description}" />`,
        meta.type === 'image' ? `<meta property="og:image" content="${meta.media}" />` : `<meta property="og:video:url" content="${meta.media}" />`,
        `<meta property="og:url" content="${meta.url}" />`,
        `<meta property="og:type" content="${meta.type}" />`,
        `<meta property="og:site_name" content="${meta.oembed.provider_name}" />`,
        meta.type === 'video' ? `<meta property="og:video:type" content="video/mp4" />` : '',

        meta.type === 'image' ? `<meta name="twitter:card" content="summary_large_image" />` : `<meta name="twitter:card" content="player" />`,
        `<meta name="twitter:title" content="${meta.title}" />`,
        `<meta name="twitter:description" content="${description}" />`,
        meta.type === 'image' ? `<meta name="twitter:image" content="${meta.media}" />` : `<meta name="twitter:player:stream" content="${meta.media}" />`,
        meta.type === 'video' ? `<meta name="twitter:player:stream:content_type" content="video/mp4" />` : '',

        `<link rel="alternate" href="https://e.buu.sh/oembed/${b64Encode(JSON.stringify(oembed))}" type="application/json+oembed" title="${meta.title}">`,
      ]

      return c.html(tags.join('\n'))
    }
  }

  return c.text('Invalid provider', 404)
})

app.get('/oembed/:id', (c) => {
  const id = c.req.param('id')
  const oembed = JSON.parse(b64Decode(id))
  return c.json({
    ...oembed,
    version: '1.0',
    type: 'link',
  })
})

app.get('/', (c) => {
  return c.html('Welcome to the <a href="https://buu.sh">buu.sh</a> embed service!')
})

export default app