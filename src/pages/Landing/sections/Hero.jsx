import heroPicture from '@/assets/hero_picture.png';

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
          <img
            src={heroPicture}
            alt="PowerGuide dashboard preview"
            className="w-full h-auto block rounded-xl"
          />
        </div>
      </div>
    </section>
  );
}
