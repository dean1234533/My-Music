import { useEffect } from 'react'

export const SITE_NAME = 'My Music'
export const DEFAULT_OG_IMAGE = '/wavelength-hero.png'

interface SeoOptions {
  title: string
  description: string
  /** Path only, e.g. '/blog/my-post' — origin is read from window.location at runtime. */
  path: string
  image?: string
  type?: 'website' | 'article'
  jsonLd?: object | object[]
}

function setMetaTag(attr: 'name' | 'property', key: string, content: string) {
  let el = document.querySelector(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

/**
 * Sets document title, meta description, canonical link, OG/Twitter tags,
 * and JSON-LD structured data for the current route. This covers real
 * browsers and any crawler that executes JS; worker/share-og.ts separately
 * pre-renders equivalent tags at the edge for crawlers that don't.
 */
export function useSeo({ title, description, path, image = DEFAULT_OG_IMAGE, type = 'website', jsonLd }: SeoOptions) {
  const jsonLdKey = jsonLd ? JSON.stringify(jsonLd) : undefined

  useEffect(() => {
    const origin = window.location.origin
    const fullTitle = title.includes(SITE_NAME) ? title : `${title} — ${SITE_NAME}`
    const absoluteImage = image.startsWith('http') ? image : `${origin}${image}`
    const canonicalUrl = `${origin}${path}`

    document.title = fullTitle
    setMetaTag('name', 'description', description)
    setMetaTag('property', 'og:title', fullTitle)
    setMetaTag('property', 'og:description', description)
    setMetaTag('property', 'og:type', type)
    setMetaTag('property', 'og:url', canonicalUrl)
    setMetaTag('property', 'og:image', absoluteImage)
    setMetaTag('name', 'twitter:card', 'summary_large_image')
    setMetaTag('name', 'twitter:title', fullTitle)
    setMetaTag('name', 'twitter:description', description)
    setMetaTag('name', 'twitter:image', absoluteImage)

    let canonical = document.querySelector('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.setAttribute('rel', 'canonical')
      document.head.appendChild(canonical)
    }
    canonical.setAttribute('href', canonicalUrl)

    const scriptId = 'seo-json-ld'
    document.getElementById(scriptId)?.remove()
    if (jsonLdKey) {
      const script = document.createElement('script')
      script.id = scriptId
      script.type = 'application/ld+json'
      script.textContent = jsonLdKey
      document.head.appendChild(script)
    }
  }, [title, description, path, image, type, jsonLdKey])
}
