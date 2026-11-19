const FAQS = [
  {
    q: 'What is PowerGuide and how does it work?',
    a: 'PowerGuide helps you prepare for power interruptions with outage reports and hazard alerts.',
  },
  {
    q: 'How can I report a power outage in my area?',
    a: 'Open Outage Reporting, add your location and details, then submit. You can track the progress of your report afterwards.',
  },
  {
    q: 'Can I see power outages and hazards near my location?',
    a: 'Yes. The map shows community-reported outages and hazards close to you.',
  },
  {
    q: 'How can I find nearby charging stations?',
    a: 'Use the charging station finder to see places near you where you can charge your devices.',
  },
  {
    q: 'Will I receive notifications about outages and hazards in my area?',
    a: 'Yes. Turn on notifications to get alerts about outages and hazards where you are.',
  },
  {
    q: 'Do I need to set my location to use PowerGuide?',
    a: 'Setting your location gives the most relevant results, but you can still browse general information without it.',
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