import { MetaTags } from "../types";

export const REGEX = /^(https?:\/\/)?(.*\.)?tiktok\.com\/.*/;

export async function redirect(og_url: URL) {
    let url = og_url

    if (url.hostname.startsWith("v")){
        const redir = await fetch(url, {
            redirect: 'manual',
        })
    
        url = new URL(redir.headers.get('location') || '')
    }

    return `https://${url.hostname}${url.pathname}`
}

interface TiktokRes {
    items: {
        author_info: {
            nickname: string,
            unique_id: string,
        },
        desc: string,
        statistics_info: {
            share_count: number,
            comment_count: number,
            digg_count: number,
        },
        video_info: {
            url_list: string[],
        }
    }[]
}

export async function meta(url: URL): Promise<MetaTags> {
    const og_url = await redirect(url)

    const og_res = await fetch(`https://www.tiktok.com/player/api/v1/items?item_ids=${url.pathname.split('/').pop()}`, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    })

    const res = await og_res.json() as TiktokRes
    const item = res.items[0]

    const stats = `${item.statistics_info.digg_count} ❤️ ${item.statistics_info.comment_count} 💬 ${item.statistics_info.share_count} 🔁`;

    return {
        title: `${item.author_info.nickname} (@${item.author_info.unique_id})`,
        description: item.desc,
        type: 'video',
        media: item.video_info.url_list[0],
        oembed: {
            provider_name: `${stats} / Provided by e.buu.sh`,
            provider_url: 'https://e.buu.sh'
        },
        url: og_url,
    }
}