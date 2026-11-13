// Prepara uma foto para guardar: roda-a como o telemóvel a tirou, reduz-a e comprime-a em JPEG.
// Só corre no browser (usa canvas), por isso não tem testes de unidade; a lógica das medidas está em photos.logic.ts.
import { fitWithin, FULL_SIDE, QUALITY_STEPS, TARGET_BYTES, THUMB_SIDE } from './photos.logic';

export interface Compressed {
  full: Blob;
  thumb: Blob;
  width: number;
  height: number;
}

/** O browser não conseguiu abrir a imagem (por exemplo, um HEIC num browser sem suporte). */
export class UnsupportedImageError extends Error {
  constructor() {
    super('Não foi possível abrir esta imagem.');
    this.name = 'UnsupportedImageError';
  }
}

interface Decoded {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}

async function decode(file: File): Promise<Decoded> {
  // `from-image` aplica a rotação guardada na foto: sem isto, as fotos tiradas na vertical saíam deitadas.
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch {
      // Cai para o método do <img>, que também aplica a rotação nos browsers atuais.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
    await image.decode();
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, release: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new UnsupportedImageError();
  }
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new UnsupportedImageError())), 'image/jpeg', quality);
  });
}

function draw(decoded: Decoded, side: number): HTMLCanvasElement {
  const { width, height } = fitWithin(decoded.width, decoded.height, side);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new UnsupportedImageError();
  // O JPEG não tem transparência: um PNG com fundo transparente ficaria preto sem isto.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.imageSmoothingQuality = 'high';
  context.drawImage(decoded.source, 0, 0, width, height);
  return canvas;
}

export async function compressImage(file: File): Promise<Compressed> {
  const decoded = await decode(file);
  try {
    const fullCanvas = draw(decoded, FULL_SIDE);
    let full = await toBlob(fullCanvas, QUALITY_STEPS[0]);
    // Se pesar mais do que o alvo, comprime-se mais, até ao limite da última qualidade.
    for (let step = 1; full.size > TARGET_BYTES && step < QUALITY_STEPS.length; step++) {
      full = await toBlob(fullCanvas, QUALITY_STEPS[step]);
    }
    const thumb = await toBlob(draw(decoded, THUMB_SIDE), 0.75);
    return { full, thumb, width: fullCanvas.width, height: fullCanvas.height };
  } finally {
    decoded.release();
  }
}
