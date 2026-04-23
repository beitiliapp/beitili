// Netlify scheduled function — runs every hour
// Schedule defined in netlify.toml

exports.handler = async function(event, context) {
  const ONESIGNAL_APP_ID  = "569868ca-1c94-4b39-a57b-1aa8ffdd3afb";
  // REST API key — set in Netlify environment variables as ONESIGNAL_REST_KEY
  const ONESIGNAL_REST_KEY = process.env.ONESIGNAL_REST_KEY;

  if (!ONESIGNAL_REST_KEY) {
    console.log("No ONESIGNAL_REST_KEY set");
    return { statusCode: 200, body: "no key" };
  }

  const now   = new Date();
  const hhmm  = String(now.getUTCHours()+3).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
  // Israel = UTC+3 (summer) / UTC+2 (winter) — approximate with +3

  // We store per-user reminder prefs in Firestore — but without server-side
  // Firestore access here, we send to ALL subscribers and let the app filter.
  // Instead: send a "check reminders" silent push — the app SW decides to show.

  async function sendPush(title, body, segment) {
    const res = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Key ${ONESIGNAL_REST_KEY}`,
      },
      body: JSON.stringify({
        app_id:           ONESIGNAL_APP_ID,
        included_segments: [segment || "All"],
        headings:   { he: "ביתילי", en: "ביתילי" },
        contents:   { he: body,     en: body },
        url:        "https://tahara-tracker.netlify.app",
        small_icon: "icon-192",
        // Send data payload — app SW checks if reminder is relevant
        data: { type: "reminder", hhmm },
        // Only deliver if app not in foreground
        isAndroid:  true,
        priority:   10,
      }),
    });
    const json = await res.json();
    console.log("Sent:", title, json.id || json.errors);
  }

  // Morning window: 06:00–09:00 Israel time
  const [h] = hhmm.split(':').map(Number);
  if (h >= 6 && h <= 9) {
    await sendPush("בדיקת בוקר", "זמן לבדיקת בוקר 🌅", "All");
  }
  // Evening window: 18:00–20:00 Israel time
  if (h >= 18 && h <= 20) {
    await sendPush("בדיקה לפני השקיעה", "זמן לבדיקה לפני השקיעה 🌇", "All");
  }

  return { statusCode: 200, body: "ok" };
};
