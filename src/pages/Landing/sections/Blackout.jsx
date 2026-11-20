import { Link } from 'react-router-dom';
import candleImage from '@/assets/lighting_candle.png';

export default function Blackout() {
  return (
    <div className="blackout">
      <section className="lights" aria-label="Blackout introduction">
        <p>
          Life doesn&apos;t stop when the light goes
          <span className="tag"><i>Out</i></span>
        </p>
      </section>

      <section className="dark" aria-labelledby="dark-heading">
        <div className="wrap mx-auto max-w-[1240px] px-[clamp(20px,6.94vw,100px)]">
          <div>
            <h2 id="dark-heading">
              A Blackout Shouldn&apos;t Leave You{' '}
              <em>Powerless</em>
            </h2>
            <p>
              When the electricity goes out, knowing what to
              do makes all the difference. Stay informed,
              manage your battery, and make every bit of power
              count.
            </p>
            <a className="link" href="#features">
              Our Solution
              <svg
                width="82"
                height="20"
                viewBox="0 0 82 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M2 10h76M68 2l10 8-10 8" />
              </svg>
            </a>
          </div>
          <div className="imgs">
            <img src={candleImage} alt="Candle lighting up a dark room during a blackout" />
          </div>
        </div>
      </section>
    </div>
  );
}