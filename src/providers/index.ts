import {
    REGEX as TIKTOK_REGEX,
    meta as TIKTOK_META,
    redirect as TIKTOK_REDIRECT,
    images as TIKTOK_IMAGES,
    json as TIKTOK_JSON,
    video as TIKTOK_VIDEO,
} from "./tiktok";


const PROVIDERS = [
    {
        regex: TIKTOK_REGEX,
        name: "TikTok",
        meta: TIKTOK_META,
        redirect: TIKTOK_REDIRECT,
        images: TIKTOK_IMAGES,
        json: TIKTOK_JSON,
        video: TIKTOK_VIDEO,
    },
];

export function getProvider(name: string) {
    console.log(name)
    return PROVIDERS.find((p) => p.name === name)
}

export function getProviderFromRegex(url: string | URL) {
    const u = url.toString()
    for (const p of PROVIDERS) {
        if (p.regex.test(u)) return p
    }
    
    return null
}