const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const os = require('os');

/**
 * Download a file from URL to temp directory.
 */
async function downloadFile(url, filename) {
  const tmpPath = path.join(os.tmpdir(), filename);
  const response = await axios({ url, responseType: 'stream', timeout: 15000 });
  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(tmpPath);
    response.data.pipe(writer);
    writer.on('finish', () => resolve(tmpPath));
    writer.on('error', reject);
  });
}

/**
 * Generate a PDF transcript for a session.
 * @param {Object} session - Session document data
 * @param {Array}  messages - Ordered array of message objects
 * @returns {string} - Path to the generated PDF file
 */
async function generateSessionPDF(session, messages) {
  const pdfPath = path.join(os.tmpdir(), `session_${session.id}_${Date.now()}.pdf`);

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 50, bottom: 50, left: 60, right: 60 },
    info: {
      Title: `Support Session - ${session.id}`,
      Author: 'Telegram Support System',
    }
  });

  const writeStream = fs.createWriteStream(pdfPath);
  doc.pipe(writeStream);

  // ── Header ──────────────────────────────────────────────────────────────────
  doc.rect(0, 0, doc.page.width, 90).fill('#0f172a');

  doc.font('Helvetica-Bold')
     .fontSize(22)
     .fillColor('#f8fafc')
     .text('Support Session Transcript', 60, 25);

  doc.font('Helvetica')
     .fontSize(10)
     .fillColor('#94a3b8')
     .text(`Session ID: ${session.id}`, 60, 55);

  doc.y = 110;

  // ── Session Info Box ────────────────────────────────────────────────────────
  const infoY = doc.y;
  doc.rect(60, infoY, doc.page.width - 120, 90).fill('#f1f5f9').stroke('#e2e8f0');

  doc.font('Helvetica-Bold').fontSize(10).fillColor('#334155');

  const col1 = 75, col2 = 300;
  const lineH = 20;

  doc.text('Customer ID:', col1, infoY + 12);
  doc.font('Helvetica').text(session.customerTelegramId || 'N/A', col1 + 90, infoY + 12);

  doc.font('Helvetica-Bold').text('Worker:', col1, infoY + 12 + lineH);
  doc.font('Helvetica').text(session.workerName || 'N/A', col1 + 90, infoY + 12 + lineH);

  doc.font('Helvetica-Bold').text('Language:', col1, infoY + 12 + lineH * 2);
  doc.font('Helvetica').text((session.language || 'en').toUpperCase(), col1 + 90, infoY + 12 + lineH * 2);

  doc.font('Helvetica-Bold').text('Started:', col2, infoY + 12);
  doc.font('Helvetica').text(formatDate(session.createdAt), col2 + 60, infoY + 12);

  doc.font('Helvetica-Bold').text('Ended:', col2, infoY + 12 + lineH);
  doc.font('Helvetica').text(formatDate(session.closedAt), col2 + 60, infoY + 12 + lineH);

  doc.font('Helvetica-Bold').text('Messages:', col2, infoY + 12 + lineH * 2);
  doc.font('Helvetica').text(String(messages.length), col2 + 60, infoY + 12 + lineH * 2);

  doc.y = infoY + 110;

  // ── Divider ─────────────────────────────────────────────────────────────────
  doc.moveTo(60, doc.y).lineTo(doc.page.width - 60, doc.y).stroke('#cbd5e1');
  doc.y += 15;

  // ── Messages ────────────────────────────────────────────────────────────────
  doc.font('Helvetica-Bold').fontSize(13).fillColor('#0f172a').text('Conversation', 60, doc.y);
  doc.y += 20;

  const downloadedImages = [];

  for (const msg of messages) {
    if (doc.y > doc.page.height - 120) {
      doc.addPage();
      doc.y = 50;
    }

    const isWorker = msg.from === 'worker';
    const bubbleColor = isWorker ? '#dbeafe' : '#f0fdf4';
    const labelColor  = isWorker ? '#1e40af' : '#166534';
    const msgX        = isWorker ? 180 : 60;
    const maxWidth    = doc.page.width - 180;
    const msgTime     = formatTime(msg.timestamp);

    // Label
    doc.font('Helvetica-Bold')
       .fontSize(9)
       .fillColor(labelColor)
       .text(`${msg.senderName || (isWorker ? 'Agent' : 'Customer')}   ${msgTime}`, msgX, doc.y);
    doc.y += 12;

    if (msg.type === 'text' && msg.content) {
      const textHeight = doc.heightOfString(msg.content, { width: maxWidth - 20 }) + 16;
      doc.rect(msgX - 5, doc.y - 2, maxWidth, textHeight).fill(bubbleColor).stroke('#e2e8f0');
      doc.font('Helvetica').fontSize(10).fillColor('#1e293b')
         .text(msg.content, msgX + 5, doc.y + 6, { width: maxWidth - 20 });
      doc.y += textHeight + 8;

    } else if (msg.type === 'image' && msg.fileUrl) {
      try {
        const ext = msg.fileUrl.includes('.jpg') ? 'jpg' : 'jpg';
        const tmpFile = await downloadFile(msg.fileUrl, `img_${Date.now()}.${ext}`);
        downloadedImages.push(tmpFile);

        doc.rect(msgX - 5, doc.y - 2, 220, 170).fill(bubbleColor).stroke('#e2e8f0');
        doc.image(tmpFile, msgX + 5, doc.y + 4, { fit: [200, 150] });
        doc.y += 175;

        if (msg.content) {
          doc.font('Helvetica-Oblique').fontSize(9).fillColor('#475569')
             .text(msg.content, msgX + 5, doc.y);
          doc.y += 14;
        }
      } catch (imgErr) {
        doc.font('Helvetica').fontSize(10).fillColor('#ef4444')
           .text('[Image could not be loaded]', msgX, doc.y);
        doc.y += 14;
      }

    } else if (msg.type === 'voice') {
      doc.rect(msgX - 5, doc.y - 2, 200, 28).fill(bubbleColor).stroke('#e2e8f0');
      doc.font('Helvetica').fontSize(10).fillColor('#475569')
         .text(`🎙️ Voice message (${msg.duration || 0}s)`, msgX + 5, doc.y + 6);
      doc.y += 38;

    } else if (msg.type === 'video') {
      doc.rect(msgX - 5, doc.y - 2, 200, 28).fill(bubbleColor).stroke('#e2e8f0');
      doc.font('Helvetica').fontSize(10).fillColor('#475569')
         .text(`🎬 Video message`, msgX + 5, doc.y + 6);
      doc.y += 38;

    } else if (msg.type === 'document') {
      doc.rect(msgX - 5, doc.y - 2, 250, 28).fill(bubbleColor).stroke('#e2e8f0');
      doc.font('Helvetica').fontSize(10).fillColor('#475569')
         .text(`📎 ${msg.fileName || 'Document'}`, msgX + 5, doc.y + 6);
      doc.y += 38;
    }

    doc.y += 4;
  }

  // ── Footer ───────────────────────────────────────────────────────────────────
  doc.y = doc.page.height - 40;
  doc.rect(0, doc.page.height - 35, doc.page.width, 35).fill('#0f172a');
  doc.font('Helvetica').fontSize(9).fillColor('#64748b')
     .text(`Generated by Telegram Support System — ${new Date().toUTCString()}`,
       60, doc.page.height - 22, { align: 'center', width: doc.page.width - 120 });

  doc.end();

  return new Promise((resolve, reject) => {
    writeStream.on('finish', () => {
      // Cleanup downloaded images
      downloadedImages.forEach(f => { try { fs.unlinkSync(f); } catch (_) {} });
      resolve(pdfPath);
    });
    writeStream.on('error', reject);
  });
}

function formatDate(ts) {
  if (!ts) return 'N/A';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatTime(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

module.exports = { generateSessionPDF };
