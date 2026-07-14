import Markdown from '@/components/Markdown';
import type { Profile } from '@/lib/types';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '';

export default function ProfileHeader({
  profile,
  projectCount,
  caseCount,
}: {
  profile: Profile;
  projectCount: number;
  caseCount: number;
}) {
  const name = profile.name.trim();
  const headline = profile.headline.trim();
  const github = profile.github.trim();
  const phone = profile.phone.trim();
  const email = profile.email.trim();
  const intro = profile.intro.trim();
  const photo = profile.photo?.trim();
  const photoSrc = photo?.startsWith('/api/') ? `${API_BASE}${photo}` : photo;
  const initial = name ? Array.from(name)[0].toUpperCase() : 'P';

  return (
    <section className="profile-header reveal" aria-label="프로필">
      <div className="profile-header-main">
        <div className="profile-photo" aria-label={name ? `${name} 프로필 사진` : '프로필 사진'}>
          {photoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element -- BE 또는 외부 URL이 제공하는 프로필 사진
            <img src={photoSrc} alt={name ? `${name} 프로필 사진` : '프로필 사진'} />
          ) : (
            <span aria-hidden="true">{initial}</span>
          )}
        </div>

        <div className="profile-copy">
          {name && <h1>{name}</h1>}
          {headline && <p className="profile-headline">{headline}</p>}

          {(github || phone || email) && (
            <div className="profile-contacts" aria-label="연락처">
              {github && (
                <a href={github} target="_blank" rel="noreferrer">
                  GitHub <span aria-hidden="true">↗</span>
                </a>
              )}
              {phone && <a href={`tel:${phone}`}>{phone}</a>}
              {email && <a href={`mailto:${email}`}>{email}</a>}
            </div>
          )}

          {intro && <Markdown className="profile-intro">{intro}</Markdown>}
        </div>
      </div>

      <dl className="profile-stats" aria-label="포트폴리오 요약">
        <div>
          <dt>Projects</dt>
          <dd>{projectCount}</dd>
        </div>
        <div>
          <dt>Case studies</dt>
          <dd>{caseCount}</dd>
        </div>
        <div>
          <dt>Proof</dt>
          <dd>Commit · PR</dd>
        </div>
      </dl>
    </section>
  );
}
