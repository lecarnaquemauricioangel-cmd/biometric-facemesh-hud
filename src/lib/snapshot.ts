/** Exporta el canvas (video + superposición) como PNG y dispara la descarga. */
export function downloadCanvasPng(canvas: HTMLCanvasElement, prefix = 'biometric-snapshot'): Promise<string> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('No se pudo generar la imagen.'));
        return;
      }
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `${prefix}-${stamp}.png`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Liberar el blob tras iniciar la descarga.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      resolve(filename);
    }, 'image/png');
  });
}
