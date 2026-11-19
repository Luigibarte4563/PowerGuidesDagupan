export default function Hero() {
  return (
    <section className="hero relative z-10 text-center text-white overflow-hidden" aria-labelledby="hero-heading">
      <div className="wrap mx-auto max-w-[1240px] px-[clamp(20px,6.94vw,100px)]">
        <h1 id="hero-heading">
          Know Before your<br />Lights goes
          <span className="tag tag--o"><i>Out</i></span>
        </h1>
        <p>
          Get real-time outage updates and
          discover practical ways to conserve energy and stay
          connected when it matters most.
        </p>
        <a className="btn" href="#contact">Get Started</a>
        <div className="mock">
          <svg
            viewBox="0 0 1030 417"
            role="img"
            aria-label="Sketch of the PowerGuide dashboard"
            className="w-full h-auto block"
          >
            <rect width="1030" height="417" fill="#808080" />
            <text x="28" y="52" fill="#153243" fontFamily="cursive" fontSize="34">
              Powerguide
            </text>
            <g fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
              <path d="M125 62C300 56 520 50 880 72M122 72C128 150 132 250 128 417" />
              <path d="M40 100q10-10 20 0t20 0M35 135q30-8 70 0M30 165q45-5 80 5M28 225q30-8 60 0M40 252q20-3 30 5" />
              <path d="M148 98q10-18 20 0t20 0t20 0t20 0t20 0t20 0" />
              <path d="M160 150c60-3 140-6 150 0 8 30 10 70 4 100-40 4-120 6-155 3zM440 135c90 4 150-6 190 20 12 20 18 40 26 55-80 12-170 25-216 20z" />
              <path d="M160 285c50-3 120-6 140 0l4 132M470 300c30-5 120-6 170-2l4 119" />
              <path d="M780 50c0-14 18-14 18 0s-10 16-18 16zM825 32c14-6 36-4 36 10s-30 18-40 6z" />
            </g>
          </svg>
        </div>
      </div>
    </section>
  );
}
