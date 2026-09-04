import QRCode from 'qrcode';
import type { ThermalReceiptData } from '../types';
import { formatCurrency } from '../utils/formatters';

export async function generateQrDataUrl(payload: string): Promise<string> {
  try {
    return await QRCode.toDataURL(payload, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 180,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
  } catch (err) {
    console.error('Error generating QR data URL:', err);
    return '';
  }
}

export async function printThermalReceipt(data: ThermalReceiptData): Promise<void> {
  let printArea = document.getElementById('thermal-printable-area');
  if (!printArea) {
    printArea = document.createElement('div');
    printArea.id = 'thermal-printable-area';
    document.body.appendChild(printArea);
  }

  const qrUrl = await generateQrDataUrl(data.qrPayload);

  printArea.innerHTML = `
    <div style="text-align: center; font-family: monospace; font-size: 11px; line-height: 1.25; color: #000; width: 100%;">
      <div style="font-size: 14px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 2px;">
        ${data.titulo}
      </div>
      <div style="font-size: 11px; font-weight: bold; margin-bottom: 2px;">
        ${data.agencia}
      </div>
      ${data.terminal ? `<div style="font-size: 10px;">Terminal: ${data.terminal}</div>` : ''}
      <div style="font-size: 10px; margin-bottom: 6px;">Cajero: ${data.cajero}</div>

      <div style="border-top: 1px dashed #000; margin: 4px 0;"></div>

      <div style="display: flex; justify-content: space-between; font-size: 10px;">
        <span>FECHA:</span>
        <span>${data.fecha} ${data.hora}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 4px;">
        <span>TICKET #:</span>
        <span style="font-weight: bold;">${data.ticketNro}</span>
      </div>

      <div style="border-top: 1px dashed #000; margin: 4px 0;"></div>

      <div style="text-align: left; font-size: 10px; margin: 4px 0;">
        <span style="color: #444;">CONCEPTO:</span><br/>
        <strong style="font-size: 11px;">${data.concepto}</strong>
      </div>
      
      <div style="display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 2px;">
        <span>MÉTODO:</span>
        <span>${data.metodoPago}</span>
      </div>

      <div style="border-top: 1px dashed #000; margin: 4px 0;"></div>

      <div style="display: flex; justify-content: space-between; align-items: baseline; margin: 6px 0;">
        <span style="font-size: 13px; font-weight: bold;">TOTAL:</span>
        <span style="font-size: 16px; font-weight: 900;">${formatCurrency(data.monto, data.moneda)}</span>
      </div>

      <div style="border-top: 1px dashed #000; margin: 6px 0;"></div>

      ${qrUrl ? `
        <div style="display: flex; flex-direction: column; align-items: center; margin: 6px 0;">
          <img src="${qrUrl}" alt="QR Ticket" style="width: 140px; height: 140px; image-rendering: pixelated; display: block;" />
          <span style="font-size: 8px; font-family: monospace; margin-top: 2px; letter-spacing: 0.5px;">${data.qrPayload.slice(0, 24)}...</span>
        </div>
      ` : ''}

      <div style="font-size: 9px; margin-top: 6px; text-transform: uppercase;">
        *** COMPROBANTE DE PAGO ***<br/>
        Conserve este ticket como respaldo.
      </div>
      <div style="margin-top: 8px; font-size: 8px;">
        taq.multibancaexpress.com
      </div>
      <div style="height: 12px;"></div>
    </div>
  `;

  // Brief delay to ensure QR image renders into DOM before print dialogue opens
  setTimeout(() => {
    window.print();
  }, 100);
}
