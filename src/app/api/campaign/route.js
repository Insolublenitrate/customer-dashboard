import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { db } from '@vercel/postgres';
import fs from 'fs';
import path from 'path';

// NOTE: The user must provide RESEND_API_KEY in their .env.local file
const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key_for_build');

export async function POST(request) {
  try {
    const { leads, subject } = await request.json();
    
    // Read the template
    const templatePath = path.join(process.cwd(), 'src', 'emails', 'campaign_template.html');
    const templateHtml = fs.readFileSync(templatePath, 'utf-8');

    if (!leads || leads.length === 0) {
      return NextResponse.json({ error: 'No leads provided' }, { status: 400 });
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'RESEND_API_KEY environment variable is not set.' }, { status: 500 });
    }

    const results = [];
    let successCount = 0;
    let failureCount = 0;

    // Dispatch emails one by one (or in batches depending on Resend limits, but 1 by 1 for personalization)
    for (const lead of leads) {
      if (!lead.email) {
        failureCount++;
        results.push({ id: lead.id, status: 'failed', error: 'No email address' });
        continue;
      }

      // Personalize the template
      const firstName = lead.name ? lead.name.split(' ')[0] : 'there';
      let personalizedHtml = templateHtml.replace(/\[Contact Name\]/g, firstName);
      
      // Additional personalization fallback if needed
      personalizedHtml = personalizedHtml.replace(/\[Company Name\]/g, lead.company || 'your company');

      try {
        const data = await resend.emails.send({
          from: 'Christopher Dillon Smith <chris@kindofabigdill.com>', // User should update this to their verified domain
          to: [lead.email],
          subject: subject || 'Is Your Manufacturing Data Ready for AI?',
          html: personalizedHtml,
        });

        successCount++;
        results.push({ id: lead.id, email: lead.email, status: 'success', data });
      } catch (err) {
        console.error(`Failed to send to ${lead.email}:`, err);
        failureCount++;
        results.push({ id: lead.id, email: lead.email, status: 'failed', error: err.message });
      }
    }

    if (successCount > 0) {
      try {
        const client = await db.connect();
        const successfulIds = results.filter(r => r.status === 'success').map(r => r.id);
        
        if (successfulIds.length > 0) {
          const idParams = successfulIds.map((_, i) => `$${i + 1}`).join(',');
          await client.query(`
            UPDATE leads 
            SET status = 'Contacted', last_contacted = NOW() 
            WHERE id IN (${idParams})
          `, successfulIds);
        }
        client.release();
      } catch (dbErr) {
        console.error("Failed to update lead statuses after campaign:", dbErr);
      }
    }

    return NextResponse.json({
      message: `Campaign sent! ${successCount} successful, ${failureCount} failed.`,
      successCount,
      failureCount,
      results
    });

  } catch (error) {
    console.error('Campaign dispatch error:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
