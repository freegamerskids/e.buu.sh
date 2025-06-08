import { MetaTags } from "../types";
import { b64Encode } from "../util";

export const REGEX = /^(https?:\/\/)?(.*\.)?tiktok\.com\/.*/;

export async function redirect(og_url: URL) {
    let url = og_url

    if (url.hostname.startsWith("v")){
        const redir = await fetch(url, {
            redirect: 'manual',
        })
    
        url = new URL(redir.headers.get('location') || '')
    }

    return new URL(`https://${url.hostname}${url.pathname}`)
}

interface TiktokRes {
    items: {
        author_info: {
            nickname: string,
            unique_id: string,
        },
        id_str: string,
        desc: string,
        statistics_info: {
            share_count: number,
            comment_count: number,
            digg_count: number,
        },
        video_info: {
            meta: {
                duration: number,
            }
            url_list: string[],
        },
        image_post_info?: {
            images: {
                display_image: {
                    height: number,
                    width: number,
                    url_list: string[],
                }
            }[],
        }
    }[]
}

async function fetchVideoData(id: string) {
    const og_res = await fetch(`https://www.tiktok.com/player/api/v1/items?item_ids=${id}`, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        cf: {
            cacheEverything: false,
            cacheTtlByStatus: {
                '200-299': 60 * 60 * 24,
                '404': 1,
                '500-599': 0,
            }
        }
    })

    const res = await og_res.json() as TiktokRes
    const item = res.items[0]

    return item
}

export async function meta(url: URL): Promise<MetaTags> {
    const og_url = await redirect(url)

    const item = await fetchVideoData(og_url.pathname.split('/').pop()!)

    const stats = `${item.statistics_info.digg_count} ❤️ ${item.statistics_info.comment_count} 💬 ${item.statistics_info.share_count} 🔁`;

    return {
        title: `${item.author_info.nickname} (@${item.author_info.unique_id})`,
        description: item.desc,
        type: item.video_info.meta.duration === 0 ? 'image' : 'video',
        media: item.video_info.meta.duration === 0 ? `https://e.buu.sh/stitch/${b64Encode(JSON.stringify({
            p: 'TikTok',
            id: item.id_str,
        }))}` : item.video_info.url_list[0],
        oembed: {
            provider_name: `${stats} / Provided by e.buu.sh`,
            provider_url: 'https://e.buu.sh'
        },
        url: og_url.toString(),
    }
}

export async function images(id: string) {
    const item = await fetchVideoData(id)

    if (!item.image_post_info) return []

    return item.image_post_info.images.map(image => ({ url: image.display_image.url_list[0], width: image.display_image.width, height: image.display_image.height }))
}