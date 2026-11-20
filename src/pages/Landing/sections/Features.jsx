import { useState, useEffect } from 'react';
import outagePicture from '@/assets/outage.png';
import hazardPicture from '@/assets/hazard.png';
import floodPicture from '@/assets/floods.png';

const FEATURES_DATA = [
  {
    eb: 'Report outages • Stay updated',
    ti: 'Stay informed about power interruptions in your community',
    bo: 'Easily report power outages in your area, provide details about affected locations, and track the progress of submitted reports. Stay updated with community-reported information to better understand the situation around you.',
    image: outagePicture,
    alt: 'Power outage reporting',
  },
  {
    eb: 'See hazards • Stay safe',
    ti: "Know what's around you before you head out",
    bo: 'See power outages and hazards near your location, and get alerts when conditions change in your area so you can plan ahead.',
    image: hazardPicture,
    alt: 'Electrical hazard alert',
  },
  {
    eb: 'Report floods • Stay prepared',
    ti: 'Track flooding in your area before it disrupts your day',
    bo: 'Report flooded roads and areas, share location and depth details, and follow community updates so you can plan safer routes and stay prepared.',
    image: floodPicture,
    alt: 'Flood reporting',
  },
];

const TABS = [
  { id: 't0', label: 'Outage Reporting' },
  { id: 't1', label: 'Hazard Alert' },
  { id: 't2', label: 'Flood Reporting' },
];

export default function Features() {
  const [activeIndex, setActiveIndex] = useState(0);

  // Sync aria attributes
  useEffect(() => {
    const tabs = document.querySelectorAll('.tab');
    const pane = document.getElementById('pane');
    tabs.forEach((tab, i) => {
      tab.setAttribute('aria-selected', i === activeIndex);
    });
    if (pane) {
      pane.setAttribute('aria-labelledby', TABS[activeIndex].id);
    }
  }, [activeIndex]);

  const handleTabClick = (index) => {
    setActiveIndex(index);
  };

  return (
    <section className="features wrap" id="features" aria-labelledby="features-heading">
      <div className="tabs" role="tablist" aria-label="Feature categories">
        {TABS.map((tab, i) => (
          <button
            key={tab.id}
            id={tab.id}
            className="tab"
            role="tab"
            aria-selected={i === activeIndex}
            aria-controls="pane"
            onClick={() => handleTabClick(i)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        className="pane"
        id="pane"
        role="tabpanel"
        aria-labelledby={TABS[activeIndex].id}
      >
        <div>
          <p id="f-eb" className="caps">
            {FEATURES_DATA[activeIndex].eb}
          </p>
          <h3 id="f-ti">{FEATURES_DATA[activeIndex].ti}</h3>
          <p id="f-bo">{FEATURES_DATA[activeIndex].bo}</p>
          <a className="btn" href="#contact">Get Started</a>
        </div>
        <div className="ph">
          <img src={FEATURES_DATA[activeIndex].image} alt={FEATURES_DATA[activeIndex].alt} />
        </div>
      </div>
    </section>
  );
}