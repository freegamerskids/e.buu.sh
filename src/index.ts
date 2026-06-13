import { Hono } from "hono";
import { PhotonImage, watermark } from "@cf-wasm/photon";

import { getProvider, getProviderFromRegex } from "./providers";
import { b64Decode, b64Encode, decryptUrl, encryptUrl } from "./util";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.get("/", (c) => {
    return c.html(
        `<!doctype html><html><body>
            <div>Welcome to the <a href="https://buu.sh">buu.sh</a> embed service!</div>
            <br/>
            <div>Add a <code>Accept: application/json</code> header or add <code>.json</code> to the end of the url to get JSON data.</div>
            <div>Similiarly, add <code>.mp4</code> or <code>.jpg</code> to the end of the url to only get the media.</div>
            <br/>
            <div>Source code is available on <a href="https://github.com/freegamerskids/e.buu.sh" target="_blank">GitHub</a>.</div>
        </body></html>`,
    );
});

app.get("/video/:id", async (c) => {
    const id = c.req.param("id");
    const data = JSON.parse(b64Decode(id));
    const provider = getProvider(data.p);
    if (!provider) return c.text("Invalid provider", 404);
    return provider.video(data.id, data.i);
});

app.get("/share/:url{.*}", async (c) => {
    let url: string | URL = c.req.param("url");
    if (!/^(https?:\/\/)/.test(url)) {
        url = `https://${url}`;
    }

    try {
        url = new URL(url);
    } catch (_e) {
        return c.text("Invalid URL", 400);
    }

    const p = getProviderFromRegex(url);
    if (p) {
        const key = c.env.ENCRYPTION_KEY;
        if (!key) return c.text("Encryption not configured", 500);

        const encrypted = await encryptUrl(url.toString(), key);
        return c.text(`https://e.buu.sh/${encrypted}`);
    }

    return c.text("No provider found", 404);
});

app.get("/oembed/:id", (c) => {
    const id = c.req.param("id");
    const oembed = JSON.parse(b64Decode(id));
    return c.json({
        ...oembed,
        version: "1.0",
        type: "link",
    });
});

app.get("/stitch/:id", async (c) => {
    const id = c.req.param("id");
    const data = JSON.parse(b64Decode(id));

    const cacheKey = new Request(`https://e.buu.sh/stitch/${id}`);
    // @ts-ignore
    const cache = caches.default;
    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) {
        return cachedResponse;
    }

    const provider = getProvider(data.p);
    if (!provider) return c.text("Invalid provider", 404);

    const images = await provider.images(data.id);
    if (!images) return c.text("No images found", 404);
    if (images.length === 1) return c.redirect(images[0].url);

    try {
        const photonImages = await Promise.all(
            images.map(async (image) => {
                const res = await fetch(image.url);
                const arrayBuffer = await res.arrayBuffer();
                return PhotonImage.new_from_byteslice(
                    new Uint8Array(arrayBuffer),
                );
            }),
        );

        const totalArea = photonImages.reduce(
            (sum: number, img: PhotonImage) =>
                sum + img.get_width() * img.get_height(),
            0,
        );
        const targetSideLength = Math.sqrt(totalArea);

        let currentWidth = 0;
        let numColumns = 0;
        for (const img of photonImages) {
            if (currentWidth + img.get_width() > targetSideLength) {
                break;
            }
            currentWidth += img.get_width();
            numColumns++;
        }
        numColumns = Math.max(1, numColumns);

        const numRows = Math.ceil(photonImages.length / numColumns);
        const rowWidths: number[] = Array.from<number>({
            length: numRows,
        }).fill(0);
        const rowHeights: number[] = Array.from<number>({
            length: numRows,
        }).fill(0);

        for (let i = 0; i < photonImages.length; i++) {
            const rowIndex = Math.floor(i / numColumns);
            const img = photonImages[i];
            rowWidths[rowIndex] += img.get_width();
            rowHeights[rowIndex] = Math.max(
                rowHeights[rowIndex],
                img.get_height(),
            );
        }

        const totalWidth = Math.max(...rowWidths);
        const totalHeight = rowHeights.reduce((sum, height) => sum + height, 0);

        const stitchedImage = new PhotonImage(
            new Uint8Array(totalWidth * totalHeight * 4),
            totalWidth,
            totalHeight,
        );

        let yOffset = 0;
        for (let row = 0; row < numRows; row++) {
            let rowWidth = 0;
            const rowStartIndex = row * numColumns;
            const rowEndIndex = Math.min(
                rowStartIndex + numColumns,
                photonImages.length,
            );
            for (let i = rowStartIndex; i < rowEndIndex; i++) {
                rowWidth += photonImages[i].get_width();
            }

            let xOffset = Math.floor((totalWidth - rowWidth) / 2);

            for (let col = 0; col < numColumns; col++) {
                const index = row * numColumns + col;
                if (index < photonImages.length) {
                    watermark(
                        stitchedImage,
                        photonImages[index],
                        BigInt(xOffset),
                        BigInt(yOffset),
                    );
                    xOffset += photonImages[index].get_width();
                }
            }
            yOffset += rowHeights[row];
        }

        const jpegBuffer = stitchedImage.get_bytes_jpeg(90);

        for (const img of photonImages) {
            img.free();
        }
        stitchedImage.free();

        const response = new Response(jpegBuffer, {
            headers: {
                "Content-Type": "image/jpeg",
                "Cache-Control": "public, max-age=31536000",
            },
        });

        c.executionCtx.waitUntil(cache.put(cacheKey, response.clone()));

        return response;
    } catch (error) {
        console.error("Error stitching images:", error);
        return c.text("Error processing images", 500);
    }
});

app.get("/:url{.*}", async (c) => {
    let param = c.req.param("url");
    let url: URL;

    // forgive me father for i have sinned
    const a = param.split(".");
    const extension = a.pop() || "";
    let isJson = /json/g.test(extension);
    let isMedia = /(mp4|webm|jpg|jpeg|png|webp|apng)/g.test(extension);
    if (isJson || isMedia) {
        param = a.join(".");
    }

    if (/^(https?:\/\/)/.test(param)) {
        try {
            url = new URL(param);
        } catch (_e) {
            return c.text("Invalid URL", 400);
        }
    } else if (c.env.ENCRYPTION_KEY) {
        try {
            url = new URL(await decryptUrl(param, c.env.ENCRYPTION_KEY));
        } catch (_e) {
            try {
                url = new URL(`https://${param}`);
            } catch (_e) {
                return c.text("Invalid URL", 400);
            }
        }
    } else {
        try {
            url = new URL(`https://${param}`);
        } catch (_e) {
            return c.text("Invalid URL", 400);
        }
    }

    const p = getProviderFromRegex(url);
    if (p) {
        if (
            c.req.header("Accept")?.includes("application/json") ||
            c.req.header("Content-Type")?.includes("application/json") ||
            isJson
        ) {
            return c.json(await p.json(url));
        }

        if (!c.req.header("User-Agent")?.toLowerCase().includes("bot")) {
            return c.redirect(await p.redirect(url));
        }

        let meta = await p.meta(url);

        if (isMedia) {
            return c.redirect(meta.media);
        }

        let description =
            meta.description.substring(0, 197) +
            (meta.description.length > 197 ? "..." : "");

        let oembed = {
            ...meta.oembed,
            author_name: meta.type === "image" ? "" : description,
            title: p.name,
        };

        const tags = [
            `<!doctype html><html lang="en-US"><head>`,

            `<meta name="theme-color" content="#8100AB"/>`,

            `<meta property="og:title" content="${meta.title}" />`,
            `<meta property="og:description" content="${description}" />`,
            meta.type === "image"
                ? `<meta property="og:image" content="${meta.media}" />`
                : `<meta property="og:video:url" content="${meta.media}" />`,
            `<meta property="og:url" content="${meta.url}" />`,
            `<meta property="og:type" content="${meta.type}" />`,
            `<meta property="og:site_name" content="${meta.oembed.provider_name}" />`,
            meta.type === "video"
                ? `<meta property="og:video:type" content="video/mp4" />`
                : "",

            meta.type === "image"
                ? `<meta name="twitter:card" content="summary_large_image" />`
                : `<meta name="twitter:card" content="player" />`,
            `<meta name="twitter:title" content="${meta.title}" />`,
            `<meta name="twitter:description" content="${description}" />`,
            meta.type === "image"
                ? `<meta name="twitter:image" content="${meta.media}" />`
                : `<meta name="twitter:player:stream" content="${meta.media}" />`,
            meta.type === "video"
                ? `<meta name="twitter:player:stream:content_type" content="video/mp4" />`
                : "",

            `<link rel="alternate" href="https://e.buu.sh/oembed/${b64Encode(JSON.stringify(oembed))}" type="application/json+oembed" title="${meta.title}">`,

            `</head></html>`,
        ];

        return c.html(tags.join("\n"));
    }

    return c.text("Invalid provider", 404);
});

export default app;
