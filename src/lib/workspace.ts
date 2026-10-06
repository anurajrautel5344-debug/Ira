import { getAccessToken } from './auth';

// Helper for authenticated requests to Google APIs
async function googleFetch(url: string, options: RequestInit = {}) {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Please sign in with Google to access Workspace features.');
  }

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    let parsed: any;
    try {
      parsed = JSON.parse(errorText);
    } catch {
      parsed = { message: errorText };
    }
    const message = parsed.error?.message || parsed.message || `Request failed with status ${res.status}`;
    throw new Error(message);
  }

  return res.json();
}

// ==========================================
// GOOGLE DRIVE
// ==========================================
export async function listDriveFiles(pageSize = 15) {
  const query = encodeURIComponent("trashed = false");
  return googleFetch(
    `https://www.googleapis.com/drive/v3/files?pageSize=${pageSize}&fields=files(id,name,mimeType,modifiedTime,webViewLink,iconLink)&q=${query}&orderBy=modifiedTime desc`
  );
}

export async function createDriveTextFile(name: string, content: string) {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated');

  const metadata = {
    name,
    mimeType: 'text/plain',
  };

  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  form.append('file', new Blob([content], { type: 'text/plain' }));

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to create file: ${err}`);
  }
  return res.json();
}

// ==========================================
// GMAIL
// ==========================================
export async function listGmailMessages(maxResults = 10) {
  const list = await googleFetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}`
  );
  if (!list.messages || list.messages.length === 0) return [];

  // Fetch snippets in parallel
  const details = await Promise.all(
    list.messages.slice(0, 5).map(async (m: { id: string }) => {
      try {
        const item = await googleFetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`
        );
        const headers = item.payload?.headers || [];
        const subject = headers.find((h: any) => h.name.toLowerCase() === 'subject')?.value || '(No Subject)';
        const from = headers.find((h: any) => h.name.toLowerCase() === 'from')?.value || 'Unknown Sender';
        const date = headers.find((h: any) => h.name.toLowerCase() === 'date')?.value || '';
        return {
          id: item.id,
          snippet: item.snippet,
          subject,
          from,
          date,
        };
      } catch {
        return { id: m.id, snippet: 'Message unavailable', subject: 'Email', from: '', date: '' };
      }
    })
  );
  return details;
}

export async function sendGmailEmail(to: string, subject: string, messageBody: string) {
  // Construct raw RFC 2822 email
  const utf8Subject = `=?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
  const emailLines = [
    `To: ${to}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: ${utf8Subject}`,
    '',
    messageBody,
  ];
  const email = emailLines.join('\r\n');
  const base64EncodedEmail = btoa(unescape(encodeURIComponent(email)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return googleFetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    body: JSON.stringify({ raw: base64EncodedEmail }),
  });
}

// ==========================================
// GOOGLE CALENDAR
// ==========================================
export async function listCalendarEvents(maxResults = 10) {
  const now = new Date().toISOString();
  return googleFetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=${maxResults}&orderBy=startTime&singleEvents=true&timeMin=${encodeURIComponent(
      now
    )}`
  );
}

export async function createCalendarEvent(
  summary: string,
  startTime: string,
  endTime: string,
  description = ''
) {
  return googleFetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    body: JSON.stringify({
      summary,
      description,
      start: { dateTime: startTime },
      end: { dateTime: endTime },
    }),
  });
}

// ==========================================
// GOOGLE TASKS
// ==========================================
export async function listTaskLists() {
  return googleFetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists');
}

export async function listTasks(taskListId = '@default') {
  return googleFetch(
    `https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks?showCompleted=true&maxResults=20`
  );
}

export async function createTask(taskListId = '@default', title: string, notes = '', due?: string) {
  const body: any = { title, notes };
  if (due) body.due = due;
  return googleFetch(`https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function completeTask(taskListId = '@default', taskId: string) {
  return googleFetch(`https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'completed' }),
  });
}

// ==========================================
// GOOGLE SHEETS
// ==========================================
export async function listSpreadsheets(pageSize = 10) {
  const query = encodeURIComponent("mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false");
  return googleFetch(
    `https://www.googleapis.com/drive/v3/files?pageSize=${pageSize}&fields=files(id,name,modifiedTime,webViewLink)&q=${query}&orderBy=modifiedTime desc`
  );
}

export async function getSpreadsheetDetails(spreadsheetId: string) {
  return googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`);
}

// ==========================================
// GOOGLE DOCS
// ==========================================
export async function listDocs(pageSize = 10) {
  const query = encodeURIComponent("mimeType = 'application/vnd.google-apps.document' and trashed = false");
  return googleFetch(
    `https://www.googleapis.com/drive/v3/files?pageSize=${pageSize}&fields=files(id,name,modifiedTime,webViewLink)&q=${query}&orderBy=modifiedTime desc`
  );
}

export async function getDocumentDetails(documentId: string) {
  return googleFetch(`https://docs.googleapis.com/v1/documents/${documentId}`);
}

// ==========================================
// GOOGLE SLIDES
// ==========================================
export async function listSlides(pageSize = 10) {
  const query = encodeURIComponent("mimeType = 'application/vnd.google-apps.presentation' and trashed = false");
  return googleFetch(
    `https://www.googleapis.com/drive/v3/files?pageSize=${pageSize}&fields=files(id,name,modifiedTime,webViewLink)&q=${query}&orderBy=modifiedTime desc`
  );
}

// ==========================================
// GOOGLE FORMS
// ==========================================
export async function listForms(pageSize = 10) {
  const query = encodeURIComponent("mimeType = 'application/vnd.google-apps.form' and trashed = false");
  return googleFetch(
    `https://www.googleapis.com/drive/v3/files?pageSize=${pageSize}&fields=files(id,name,modifiedTime,webViewLink)&q=${query}&orderBy=modifiedTime desc`
  );
}

// ==========================================
// GOOGLE CHAT
// ==========================================
export async function listChatSpaces() {
  return googleFetch('https://chat.googleapis.com/v1/spaces');
}

// ==========================================
// GOOGLE MEET
// ==========================================
export async function createMeetingSpace() {
  return googleFetch('https://meet.googleapis.com/v2/spaces', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

// ==========================================
// GOOGLE CONTACTS (PEOPLE API)
// ==========================================
export async function listContacts(pageSize = 20) {
  return googleFetch(
    `https://people.googleapis.com/v1/people/me/connections?pageSize=${pageSize}&personFields=names,emailAddresses,phoneNumbers,photos`
  );
}
