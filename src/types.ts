export interface MetaTags {
    type: "image" | "video",
    media: string,
    title: string,
    description: string,
    url: string,
    oembed: {
        provider_name: string,
        provider_url: string
    }
}