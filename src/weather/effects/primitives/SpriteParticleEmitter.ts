export class SpriteParticleEmitter<TParticle> {
  private particles: TParticle[] = [];

  clear(): void {
    this.particles = [];
  }

  add(particle: TParticle): void {
    this.particles.push(particle);
  }

  update(stepper: (particle: TParticle) => boolean): void {
    const nextParticles: TParticle[] = [];
    for (const particle of this.particles) {
      if (stepper(particle)) {
        nextParticles.push(particle);
      }
    }
    this.particles = nextParticles;
  }

  forEach(visitor: (particle: TParticle) => void): void {
    for (const particle of this.particles) {
      visitor(particle);
    }
  }
}
