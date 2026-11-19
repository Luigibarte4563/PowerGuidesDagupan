const FAQS = [
  {
    q: 'What is PowerGuide and how does it work?',
    a: 'PowerGuide is a community app for Dagupan. You can report outages, floods and electrical hazards, see maintenance schedules and power stations, and follow reports on a live map.',
  },
  {
    q: 'How can I report a power outage in my area?',
    a: 'Open Outage Reporting, add your location and details, then submit. You can track the progress of your report afterwards.',
  },
  {
    q: 'Can I see power outages and hazards on a map?',
    a: 'Yes. The Outages and Hazards pages each have a live map and feed of community reports across Dagupan. Saving your location also unlocks the Near my location views for power stations, floods and risk areas.',
  },
  {
    q: 'How can I find a place to charge my devices during an outage?',
    a: 'Open Power Stations and use the Near my location tab to see the closest reported charging stations, power banks, generators and solar stations. You can also post one yourself.',
  },
  {
    q: 'How will I know when a report or maintenance schedule changes?',
    a: 'Notifications are created automatically and appear in your Notifications page. You will get one when a flood or hazard report you filed changes status, or when a maintenance schedule in your area is posted or changed. There is no separate switch to turn on.',
  },
  {
    q: 'Do I need to set my location to use PowerGuide?',
    a: 'Yes. Residents are asked to set their location before they can enter the dashboard. It is used to show nearby reports, power stations and risk areas, and to send maintenance notices for your area.',
  },
];

export default function FAQs() {
  return (
    <section className="faqs" id="faq" aria-labelledby="faq-heading">
      <div className="hd">
        <p className="eyebrow">Common Questions with Quick answers</p>
        <h2 id="faq-heading">
          Frequently Asked Questions
        </h2>
        <p className="sub">
          Find answers to common questions about Power Guide, its
          features, and how it can help you stay prepared during
          power interruptions.
        </p>
      </div>

      <div className="faq">
        {FAQS.map((faq, i) => (
          <details key={i}>
            <summary>{faq.q}</summary>
            <p>{faq.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}