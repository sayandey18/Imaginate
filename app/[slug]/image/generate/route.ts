import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@gradio/client';

// Define interfaces
interface ImageRequest {
    prompt: string;
    seed?: number;
    randomize_seed?: boolean;
    width?: number;
    height?: number;
    num_inference_steps?: number;
}

interface ImageResponse {
    status: boolean;
    path?: string;
    url?: string;
    meta?: {
        _type: string;
        seed: number;
        width: number;
        height: number;
        steps: number;
        [key: string]: unknown;
    };
    error?: string;
}

interface FluxData {
    path: string;
    url: string;
    size: null | number;
    orig_name: string;
    mime_type: null | string;
    is_stream: boolean;
    meta: {
        _type: string;
        [key: string]: unknown;
    };
}

// Set runtime configuration for Node.js with maximum execution time
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes

// Create client connection once and reuse it across requests
let clientPromise: Promise<any> | null = null;

const authToken = process.env.FLUX_API_KEY || '';

export async function GET() {
    return NextResponse.json({ status: 'Server is up and running' }, { status: 200 });
}

export async function POST(req: NextRequest) {
    // Validate authorization token
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.split(' ')[1] !== authToken) {
        return NextResponse.json({
            status: false,
            error: 'Unauthorized, invalid or missing API key'
        }, { status: 401 });
    }

    try {
        const body: ImageRequest = await req.json();
        
        // Validate required prompt
        if (!body.prompt) {
            return NextResponse.json({
                status: false,
                error: 'Image prompt is required'
            }, { status: 400 });
        }

        // Initialize client if not already done
        if (!clientPromise) {
            clientPromise = Client.connect('black-forest-labs/FLUX.1-schnell');
        }
        
        // Get client instance
        const client = await clientPromise;
        
        // Make the prediction with parameters from the payload
        const result = await client.predict('/infer', {
            prompt: body.prompt,
            seed: body.seed ?? 1311721057,
            randomize_seed: body.randomize_seed ?? false,
            width: body.width ?? 540,
            height: body.height ?? 960,
            num_inference_steps: body.num_inference_steps ?? 25
        });
        
        // Process the result
        const [imageData, generatedSeed] = result.data as [FluxData, number];
        
        // Construct the response
        const response: ImageResponse = {
            status: true,
            path: imageData.path,
            url: imageData.url,
            meta: {
                ...imageData.meta,
                seed: generatedSeed,
                width: body.width ?? 540,
                height: body.height ?? 960,
                steps: body.num_inference_steps ?? 25
            }
        };

        return NextResponse.json(response, { status: 200 });
    } catch (error) {
        // Log error and reset client on failure
        console.error('Error generating image:', error);
        clientPromise = null;
        
        return NextResponse.json({
            status: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        }, { status: 500 });
    }
}
