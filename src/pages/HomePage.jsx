import heroImg from '../assets/hero.png'

function HomePage() {
  return (
    <section className="hero-simple">
      <img src={heroImg} alt="Simply Neighbor" className="hero-simple-image" />
      <div className="hero-simple-copy">
        <h1>Neighborhood rentals for everyday needs.</h1>
        <p>
          Simply Neighbor is where people rent tools, event gear, moving equipment,
          vehicles, and more from trusted neighbors nearby.
        </p>
      </div>
    </section>
  )
}

export default HomePage
