/**
 * Product visuals for /solutions. These are illustrative mock-ups built in
 * HTML (not screenshots), so the Twin Chat one can be private-labelled for a
 * sample company as Bill asked, and swapped for real screenshots later.
 */

/** Twin Chat, white-labelled for a sample real-estate company. */
export function TwinChatMock() {
  return (
    <div className="mock chat" aria-label="Twin Chat, private-labelled for a sample company">
      <div className="chat__side">
        <div className="chat__brand"><span className="chat__brandmark">H</span><span>Harbor Realty</span></div>
        <nav className="chat__tabs">
          <span className="is-on">Chat</span><span>CRM</span><span>Events</span><span>Market intel</span><span>Media</span><span>Vault</span>
        </nav>
        <div className="chat__apps">Apps on: <b>4 of 9</b></div>
      </div>
      <div className="chat__main">
        <div className="chat__bar"><i /><i /><i /><span>Harbor Realty · AI twin</span></div>
        <div className="chat__msgs">
          <div className="chat__msg chat__msg--me">Any new buyers from the Oak St listing?</div>
          <div className="chat__msg">
            3 real buyers out of 14 comments. <b>Daniel Chen</b> is pre-approved, budget $1.2M, timeline 60 days. I've drafted a reply and saved him to your Vault.
            <div className="chat__actions"><button type="button">Approve reply</button><button type="button">Book showing</button><button type="button">Edit</button></div>
          </div>
          <div className="chat__msg chat__msg--me">Book him Wednesday 2pm.</div>
          <div className="chat__msg">Done. Showing added to the calendar and to <code>/vault/buyers/daniel-chen</code>.</div>
        </div>
        <div className="chat__input"><span>Message your twin…</span><b>⏎</b></div>
      </div>
      <p className="mock__note">Sample company. Your name, colours and apps go here.</p>
    </div>
  );
}

/** A day of media: the podcast and a video, delivered into the Vault. */
export function MediaMock() {
  return (
    <div className="mock media" aria-label="Daily podcast and video, delivered automatically">
      <div className="media__pod">
        <div className="media__podhead">
          <span className="media__tag">Daily podcast</span>
          <span className="media__time">Today · 7:12</span>
        </div>
        <h3>Las Vegas Market Minute</h3>
        <p>Weather, three open houses, the convention crowd, and what it means for sellers this week.</p>
        <div className="media__wave" aria-hidden="true">
          {Array.from({ length: 38 }, (_, i) => <i key={i} style={{ height: `${18 + 60 * Math.abs(Math.sin(i * 0.9)) * (0.5 + ((i * 7) % 5) / 10)}%` }} />)}
        </div>
        <div className="media__row"><button type="button" className="media__play" aria-label="Play">▶</button><span>In your voice · posted to Instagram, YouTube, Spotify</span></div>
      </div>
      <div className="media__video">
        <img src="/videos/hero-1.jpg" alt="" />
        <div className="media__videoinfo"><span className="media__tag">Explainer video</span><b>Why your listing needs a twin</b><span>0:48 · AI avatar · ready for review</span></div>
      </div>
      <p className="mock__note">Delivered into your Vault every morning.</p>
    </div>
  );
}

/** Consulting: the roadmap we leave behind. */
export function ConsultingMock() {
  const rows = [
    { what: "Client intake and approvals", fit: "App", when: "Weeks 1–4" },
    { what: "Agent for first-line questions", fit: "AI Twin", when: "Weeks 2–5" },
    { what: "Monthly explainer content", fit: "Media", when: "Week 3 on" },
    { what: "Records into one Vault", fit: "Vault", when: "Weeks 1–2" },
  ];
  return (
    <div className="mock roadmap" aria-label="Example AI roadmap">
      <div className="roadmap__head"><span className="media__tag">AI roadmap</span><span>Example · pharmaceutical client</span></div>
      <table>
        <thead><tr><th>Where AI pays for itself</th><th>Fits</th><th>When</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.what}><td>{r.what}</td><td><b>{r.fit}</b></td><td>{r.when}</td></tr>)}</tbody>
      </table>
      <p className="mock__note">You leave the first session with this, costed.</p>
    </div>
  );
}
