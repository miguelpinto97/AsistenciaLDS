import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';

async function extractText() {
    const pdfPath = 'c:/Miguel Pinto/Personal/Asistencia_Clases_Iglesia/DocumentosBase/TodasLasListas.pdf';
    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const loadingTask = pdfjsLib.getDocument({data});
    const pdf = await loadingTask.promise;
    
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + '\n';
    }
    fs.writeFileSync('c:/Miguel Pinto/Personal/Asistencia_Clases_Iglesia/sample_structure.txt', fullText);
    console.log('Sample structure saved to c:/Miguel Pinto/Personal/Asistencia_Clases_Iglesia/sample_structure.txt');
}

extractText().catch(console.error);
