import { MetaTags } from "../types";
import { b64Encode, simplifyNumber } from "../util";

export const REGEX = /^(https?:\/\/)?(.*\.)?tiktok\.com\/.*/;

export async function redirect(og_url: URL) {
    let url = og_url

    if (url.hostname.startsWith("v")){
        const redir = await fetch(url, {
            redirect: 'manual',
        })
    
        url = new URL(redir.headers.get('location') || '')
    }

    if (url.pathname.includes('/photo')){
        url = new URL(url.toString().replace('/photo', '/video'))
    }

    return `https://${url.hostname}${url.pathname}`
}

interface TiktokRes {
    author: {
        id: string,
        nickname: string,
        uniqueId: string,
        signature: string,
        avatarLarger: string,
    },
    id: string,
    desc: string,
    stats: {
        shareCount: number,
        commentCount: number,
        diggCount: number,
        playCount: number,
        collectCount: number,
    },
    video: {
        duration: number,
        playAddr: string,
    },
    bitrateInfo: {
        Bitrate: number,
        QualityType: number,
        BitrateFPS: number,
        PlayAddr: {
            UrlList: string[],
        }
    }[],
    music: {
        id: string,
        title: string,
        playUrl: string,
        coverLarge: string,
        authorName: string,
    },
    imagePost?: {
        images: {
            imageURL: {
                urlList: string[],
            },
            imageWidth: number,
            imageHeight: number,
        }[],
    }
}

async function fetchVideoData(url: string): Promise<[TiktokRes, string]> {
    const og_res = await fetch(url, {
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

    let cookies: string = '';
    for (const header of og_res.headers.getSetCookie()) {
        let cookie = header.split(';')[0];
        cookies += `${cookie}; `;
    }

    const res = await og_res.text()

    return [JSON.parse(res.split('<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">')[1].split('</script>')[0])["__DEFAULT_SCOPE__"]["webapp.video-detail"]["itemInfo"]["itemStruct"] as TiktokRes, cookies]
}

export async function meta(url: URL): Promise<MetaTags> {
    const og_url = await redirect(url)

    const [item] = await fetchVideoData(og_url)

    const stats = `${simplifyNumber(item.stats.diggCount)} ❤️ ${simplifyNumber(item.stats.commentCount)} 💬 ${simplifyNumber(item.stats.collectCount)} 🔖 ${simplifyNumber(item.stats.shareCount)} 🔁 ${simplifyNumber(item.stats.playCount)} 👁️`;

    return {
        title: `${item.author.nickname} (@${item.author.uniqueId})`,
        description: item.desc,
        type: item.video.duration === 0 ? 'image' : 'video',
        media: item.video.duration === 0 ? `https://e.buu.sh/stitch/${b64Encode(JSON.stringify({
            p: 'TikTok',
            id: og_url.toString(),
        }))}` : `https://e.buu.sh/video/${b64Encode(JSON.stringify({
            p: 'TikTok',
            id: og_url.toString(),
            i: 0,
        }))}`,
        oembed: {
            provider_name: `${stats} / Provided by e.buu.sh`,
            provider_url: 'https://e.buu.sh'
        },
        url: og_url.toString(),
    }
}

export async function images(id: string) {
    const [item] = await fetchVideoData(id)

    if (!item.imagePost) return []

    return item.imagePost.images.map(image => ({ url: image.imageURL.urlList[0], width: image.imageWidth, height: image.imageHeight }))
}

export async function video(id: string, index: number = 0) {
    const [item, cookies] = await fetchVideoData(id)

    return await fetch(item.bitrateInfo[index].PlayAddr.UrlList[0], {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://www.tiktok.com/',
            'Range': 'bytes=0-',
            'Cookie': cookies,
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
}

export async function json(url: URL): Promise<TiktokRes> {
    const og_url = await redirect(url)

    const [item] = await fetchVideoData(og_url)

    const { author, id, desc, stats, video, music, imagePost, bitrateInfo } = item

    console.log(bitrateInfo)

    return {
        author: {
            id: author.id,
            nickname: author.nickname,
            uniqueId: author.uniqueId,
            signature: author.signature,
            avatarLarger: author.avatarLarger,
        },
        id,
        desc,
        stats: {
            shareCount: stats.shareCount,
            commentCount: stats.commentCount,
            diggCount: stats.diggCount,
            playCount: stats.playCount,
            collectCount: stats.collectCount,
        },
        video: {
            duration: video.duration,
            playAddr: video.duration === 0 ? '' : `https://e.buu.sh/video/${b64Encode(JSON.stringify({
                p: 'TikTok',
                id: og_url.toString(),
                i: 0,
            }))}`,
        },
        bitrateInfo: bitrateInfo.map(info => ({
            Bitrate: info.Bitrate,
            QualityType: info.QualityType,
            BitrateFPS: info.BitrateFPS,
            PlayAddr: {
                UrlList: info.PlayAddr.UrlList.map((addr, i) => `https://e.buu.sh/video/${b64Encode(JSON.stringify({
                    p: 'TikTok',
                    id: og_url.toString(),
                    i,
                }))}`),
            },
        })),
        music: {
            id: music.id,
            title: music.title,
            playUrl: music.playUrl,
            coverLarge: music.coverLarge,
            authorName: music.authorName,
        },
        imagePost: imagePost ? {
            images: imagePost.images.map(image => ({
                imageURL: {
                    urlList: image.imageURL.urlList,
                },
                imageWidth: image.imageWidth,
                imageHeight: image.imageHeight,
            })),
        } : undefined,
    }
}