declare module 'colorthief' {
    export default class ColorThief {
        getColor(img: HTMLImageElement | HTMLCanvasElement, quality?: number): [number, number, number];
        getPalette(img: HTMLImageElement | HTMLCanvasElement, colorCount?: number, quality?: number): [number, number, number][];
    }
}
