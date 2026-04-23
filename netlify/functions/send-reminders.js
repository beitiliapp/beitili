// Netlify scheduled function — runs every 15 minutes
// Reads per-user settings from Firestore and sends only to relevant users
const https = require('https');

exports.handler = async function(event, context) {
  const ONESIGNAL_APP_ID   = "569868ca-1c94-4b39-a57b-1aa8ffdd3afb";
  const ONESIGNAL_REST_KEY = process.env.ONESIGNAL_REST_KEY;
  const FIREBASE_PROJECT   = "beitili-c120c";
  const FIREBASE_API_KEY   = process.env.FIREBASE_API_KEY; // optional, for auth

  if (!ONESIGNAL_REST_KEY) return { statusCode: 200, body: "no onesignal key" };

  // Current Israel time
  const now = new Date();
  const israelTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
  const hh = String(israelTime.getHours()).padStart(2,'0');
  const mm = israelTime.getMinutes();
  // Round to nearest 15 min
  const mmR = String(Math.round(mm/15)*15 === 60 ? 0 : Math.round(mm/15)*15).padStart(2,'0');
  const currentSlot = `${hh}:${mmR}`;
  console.log(`Israel time: ${hh}:${String(mm).padStart(2,'0')}, slot: ${currentSlot}`);

  // Fetch all user docs from Firestore REST API (no SDK needed)
  async function fetchFirestore() {
    return new Promise((resolve) => {
      const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/users`;
      https.get(url, (res) => {
        let data = '';
        res.on('data', d => data += d);
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch(e) { resolve(null); }
        });
      }).on('error', () => resolve(null));
    });
  }

  // Send push via OneSignal to specific external_id (user uid)
  async function sendToUser(uid, title, body) {
    return new Promise((resolve) => {
      const payload = JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        filters: [{ field:"tag", key:"uid", relation:"=", value: uid }],
        headings: { he: "ביתילי", en: "ביתילי" },
        contents: { he: body, en: body },
        url: "https://beitili-app.netlify.app",
      });
      const options = {
        hostname: 'onesignal.com',
        path: '/api/v1/notifications',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Key ${ONESIGNAL_REST_KEY}`,
          'Content-Length': Buffer.byteLength(payload),
        }
      };
      const req = https.request(options, (res) => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => { console.log('sent to', uid, d.slice(0,80)); resolve(); });
      });
      req.on('error', e => { console.warn('send error:', e.message); resolve(); });
      req.write(payload);
      req.end();
    });
  }

  // Send to ALL subscribers (fallback when no per-user data)
  async function sendToAll(title, body) {
    return new Promise((resolve) => {
      const payload = JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        included_segments: ["All"],
        headings: { he: "ביתילי", en: "ביתילי" },
        contents: { he: body, en: body },
        url: "https://beitili-app.netlify.app",
      });
      const options = {
        hostname: 'onesignal.com',
        path: '/api/v1/notifications',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Key ${ONESIGNAL_REST_KEY}`,
          'Content-Length': Buffer.byteLength(payload),
        }
      };
      const req = https.request(options, res => {
        let d = ''; res.on('data', c => d+=c);
        res.on('end', () => { console.log('sent to all:', d.slice(0,80)); resolve(); });
      });
      req.on('error', e => { console.warn(e.message); resolve(); });
      req.write(payload); req.end();
    });
  }

  // Try to read per-user settings from Firestore
  const fsData = await fetchFirestore();
  const userDocs = fsData?.documents;

  if (userDocs && userDocs.length > 0) {
    // Per-user: send only to users whose reminder time matches current slot
    for (const userDoc of userDocs) {
      try {
        // uid from path: projects/.../users/{uid}
        const uid = userDoc.name.split('/users/')[1].split('/')[0];
        // Get the main data doc
        const mainDocUrl = `https://firestore.googleapis.com/v1/${userDoc.name}/data/main`;
        const mainData = await new Promise(resolve => {
          https.get(mainDocUrl, res => {
            let d = ''; res.on('data', c => d+=c);
            res.on('end', () => { try{resolve(JSON.parse(d));}catch{resolve(null);} });
          }).on('error', () => resolve(null));
        });

        if (!mainData?.fields?.settings) continue;
        const s = mainData.fields.settings.mapValue?.fields;
        if (!s) continue;

        const remindersEnabled = s.remindersEnabled?.booleanValue;
        const vesetEnabled     = s.vesetRemindersEnabled?.booleanValue;
        const morningTime      = s.morningReminder?.stringValue || '07:00';
        const eveningTime      = s.eveningReminder?.stringValue || '19:00';
        const vesetTime        = s.vesetReminder?.stringValue   || '08:00';

        if (remindersEnabled && morningTime === currentSlot) {
          await sendToUser(uid, "בדיקת בוקר", "זמן לבדיקת בוקר 🌅");
        }
        if (remindersEnabled && eveningTime === currentSlot) {
          await sendToUser(uid, "בדיקה לפני השקיעה", "זמן לבדיקה לפני השקיעה 🌇");
        }
        if (vesetEnabled && vesetTime === currentSlot) {
          await sendToUser(uid, "תזכורת וסתות", "בדקי אם יש וסת צפוי היום 📅");
        }
      } catch(e) { console.warn('user error:', e.message); }
    }
  } else {
    // Fallback: no Firestore access — send to all at common times
    console.log('No Firestore data, sending to all at slot:', currentSlot);
    const [h] = currentSlot.split(':').map(Number);
    if (currentSlot === '07:00') await sendToAll("בדיקת בוקר", "זמן לבדיקת בוקר 🌅");
    if (currentSlot === '19:00') await sendToAll("בדיקה לפני השקיעה", "זמן לבדיקה לפני השקיעה 🌇");
  }

  return { statusCode: 200, body: `done at ${currentSlot}` };
};
