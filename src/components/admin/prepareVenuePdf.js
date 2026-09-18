// Preserve the user's original; upload a smaller reading copy for oversized PDFs.
const MAX_READER_BYTES = 8 * 1024 * 1024;

export async function prepareVenuePdf(file, onProgress = () => {}) {
  if (!/\.pdf$/i.test(file.name)) throw new Error('Please choose a PDF file.');
  if (file.size > 75 * 1024 * 1024) throw new Error('Please split PDFs larger than 75 MB into smaller documents.');
  const [pdfjs, { default: workerUrl }] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const loading = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false });
  try {
    const pdf = await loading.promise;
    if (pdf.numPages > 100) throw new Error('Please split this PDF into documents of 100 pages or fewer.');
    const compress = file.size > MAX_READER_BYTES;
    const { jsPDF } = compress ? await import('jspdf') : {};
    let compact;
    const pages = [];
    for (let number = 1; number <= pdf.numPages; number++) {
      onProgress(`Preparing page ${number} of ${pdf.numPages}...`);
      const page = await pdf.getPage(number);
      const text = await page.getTextContent();
      pages.push(`PAGE ${number}\n` + text.items.map(item => item.str + (item.hasEOL ? '\n' : ' ')).join(''));
      if (compress) {
        const size = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: 1600 / Math.max(size.width, size.height) });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        try {
          await page.render({ canvasContext: canvas.getContext('2d'), viewport, background: '#ffffff' }).promise;
          const orientation = size.width > size.height ? 'landscape' : 'portrait';
          if (!compact) compact = new jsPDF({ orientation, unit: 'pt', format: [size.width, size.height], compress: true });
          else compact.addPage([size.width, size.height], orientation);
          compact.addImage(canvas.toDataURL('image/jpeg', 0.78), 'JPEG', 0, 0, size.width, size.height);
        } finally {
          canvas.width = canvas.height = 0;
        }
      }
      page.cleanup();
    }
    const documentText = pages.join('\n\n');
    if (documentText.length > 150000) throw new Error('This document has too much text for one import. Please split it into smaller PDFs.');
    const uploadFile = compact ? new File([compact.output('blob')], file.name, { type: 'application/pdf' }) : file;
    if (uploadFile.size > MAX_READER_BYTES) throw new Error('The prepared PDF is still too large to read reliably. Please split it into smaller PDFs and upload each separately.');
    return { file: uploadFile, documentText, pageCount: pdf.numPages };
  } finally {
    await loading.destroy();
  }
}
