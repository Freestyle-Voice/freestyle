// Freestyle — Onboarding (editorial push). Three-step flow on a single
// shell — Welcome, Permissions, Voice Model.

// Step pill at the top of the window
function StepPill({ index, total, label, current }) {
  const isCurrent = index === current;
  const isPast = index < current;
  return (
    <div style={{ display:'inline-flex', alignItems:'center', gap: 8 }}>
      <span style={{
        width: 22, height: 22, borderRadius: '50%',
        background: isPast ? R.OLIVE : isCurrent ? R.OLIVE : R.PAPER,
        border: isPast ? 'none' : isCurrent ? `1px solid ${R.OLIVE_DEEP}` : `1px solid ${R.RULE}`,
        color: isPast || isCurrent ? R.CANVAS : R.MUTE,
        fontSize: 10, fontWeight: 600,
        display:'inline-flex', alignItems:'center', justifyContent:'center',
        fontFamily: 'JetBrains Mono',
      }}>
        {isPast ? <span style={{ display:'inline-flex' }}>{I.check({ size: 12, strokeWidth: 2.4 })}</span> : index + 1}
      </span>
      <span className="mono" style={{
        fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase',
        color: isCurrent ? R.INK : R.MUTE, fontWeight: isCurrent ? 500 : 400,
      }}>{label}</span>
    </div>
  );
}

function StepsHeader({ current }) {
  const steps = ['Welcome', 'Permissions', 'Voice model'];
  return (
    <div style={{
      display:'flex', alignItems:'center', justifyContent:'center', gap: 18,
      padding: '24px 0', borderBottom: `1px solid ${R.RULE_SOFT}`,
      flexShrink: 0,
    }}>
      {steps.map((label, i) => (
        <React.Fragment key={label}>
          <StepPill index={i} total={steps.length} label={label} current={current} />
          {i < steps.length - 1 && (
            <span style={{ width: 32, height: 1, background: i < current ? R.OLIVE : R.RULE }} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ============================================================
// STEP 1 — WELCOME
// ============================================================
function OnboardingWelcome() {
  return (
    <MacWindow width={1100} height={780} title="Freestyle">
      <div style={{ flex: 1, display:'flex', flexDirection:'column', background: R.CANVAS }}>
        <StepsHeader current={0} />
        <div style={{
          flex: 1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
          padding: '40px 64px', position:'relative',
        }}>
          {/* Big wave behind */}
          <div style={{ position:'absolute', inset: 0, display:'flex', alignItems:'center', justifyContent:'center', opacity: 0.12, pointerEvents:'none' }}>
            <Wave size={1100} color={R.OLIVE} height={520} />
          </div>
          <div style={{ position:'relative', zIndex: 1, textAlign:'center', maxWidth: 720 }}>
            <Wave size={56} color={R.OLIVE} />
            <h1 style={{ margin: '24px 0 16px' }}>
              <span className="serif" style={{ fontSize: 100, lineHeight: 0.92, letterSpacing:'-0.035em', color: R.INK, fontWeight: 400 }}>Speak </span>
              <span className="serif-italic" style={{ fontSize: 100, lineHeight: 0.92, color: R.OLIVE }}>freely.</span>
            </h1>
            <p style={{ margin: '0 auto 32px', fontSize: 18, color: R.INK_SOFT, lineHeight: 1.5, maxWidth: 520, textWrap:'pretty' }}>
              Hold a hotkey anywhere on your Mac, speak, release.
              Your words appear at your cursor — Slack, Notes, the URL bar, any app.
            </p>
            <div style={{ display:'inline-flex', alignItems:'center', gap: 14 }}>
              <Btn kind="primary">Get started{' '}<span style={{ display:'inline-flex' }}>{I.arrowR({ size: 13 })}</span></Btn>
              <span className="mono" style={{ fontSize: 11, color: R.MUTE, letterSpacing:'0.12em' }}>TAKES 90 SECONDS</span>
            </div>
          </div>
        </div>
      </div>
    </MacWindow>
  );
}

// ============================================================
// STEP 2 — PERMISSIONS
// ============================================================
function OnboardingPermissions() {
  return (
    <MacWindow width={1100} height={780} title="Freestyle">
      <div style={{ flex: 1, display:'flex', flexDirection:'column', background: R.CANVAS }}>
        <StepsHeader current={1} />
        <div style={{
          flex: 1, display:'flex', alignItems:'center', justifyContent:'center',
          padding: '40px 80px',
        }}>
          <div style={{ maxWidth: 640, width: '100%' }}>
            <h1 className="serif" style={{ margin: 0, fontSize: 56, lineHeight: 0.95, letterSpacing:'-0.025em', color: R.INK, fontWeight: 400 }}>
              <span>A few </span>
              <span className="serif-italic" style={{ color: R.OLIVE }}>permissions.</span>
            </h1>
            <p style={{ margin: '12px 0 32px', fontSize: 15, color: R.INK_SOFT, maxWidth: 460, lineHeight: 1.5 }}>
              Freestyle stays out of your way, but it needs two macOS permissions to do its job.
            </p>

            <div style={{ display:'flex', flexDirection:'column', gap: 10 }}>
              <PermCard
                icon={I.mic}
                title="Microphone"
                desc="So we can hear what you say."
                granted
              />
              <PermCard
                icon={I.shield}
                title="Accessibility"
                desc="So we can detect your global hotkey and paste text into other apps."
                granted={false}
              />
              <PermCard
                icon={I.keyboard}
                title="Hotkey · ⌥ Space"
                desc="Hold to record, release to transcribe. Change it anytime in Settings."
                info
              />
            </div>

            <div style={{ marginTop: 32, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <Btn kind="ghost">Back</Btn>
              <Btn kind="primary">Continue{' '}<span style={{ display:'inline-flex' }}>{I.arrowR({ size: 13 })}</span></Btn>
            </div>
          </div>
        </div>
      </div>
    </MacWindow>
  );
}

function PermCard({ icon, title, desc, granted, info }) {
  return (
    <div style={{
      background: R.ELEVATED, border: `1px solid ${R.RULE}`, borderRadius: 12,
      padding: '16px 18px', display:'flex', alignItems:'center', gap: 14,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 9, flexShrink: 0,
        background: granted ? R.OLIVE_SOFT : info ? R.PAPER : R.PAPER,
        border: `1px solid ${granted ? `${R.OLIVE}33` : R.RULE}`,
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>
        <span style={{ color: granted ? R.OLIVE_DEEP : R.MUTE, display:'inline-flex' }}>{icon({ size: 16 })}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: R.INK }}>{title}</div>
        <div style={{ fontSize: 12.5, color: R.MUTE, marginTop: 2, lineHeight: 1.45 }}>{desc}</div>
      </div>
      {granted ? (
        <span className="mono" style={{
          display:'inline-flex', alignItems:'center', gap: 6,
          color: R.OLIVE_DEEP, fontSize: 10.5, letterSpacing:'0.14em', textTransform:'uppercase',
        }}>
          <span style={{ display:'inline-flex' }}>{I.check({ size: 13, strokeWidth: 2.2 })}</span> Granted
        </span>
      ) : info ? null : (
        <Btn kind="primary">Open Settings</Btn>
      )}
    </div>
  );
}

// ============================================================
// STEP 3 — VOICE MODEL
// ============================================================
function OnboardingVoiceModel() {
  const recs = [
    { p: 'groq', label: 'Groq', model: 'whisper-large-v3-turbo', sub: 'Fastest · ~$0.04/hour', selected: true },
    { p: 'openai', label: 'OpenAI', model: 'gpt-4o-mini-transcribe', sub: 'Most accurate · ~$0.18/hour' },
    { p: 'deepgram', label: 'Deepgram', model: 'nova-3', sub: 'Streaming partials · ~$0.26/hour' },
    { p: 'elevenlabs', label: 'ElevenLabs', model: 'scribe-v1', sub: 'Multi-language · ~$0.40/hour' },
  ];
  return (
    <MacWindow width={1100} height={780} title="Freestyle">
      <div style={{ flex: 1, display:'flex', flexDirection:'column', background: R.CANVAS }}>
        <StepsHeader current={2} />
        <div style={{
          flex: 1, display:'flex', alignItems:'center', justifyContent:'center',
          padding: '40px 80px',
        }}>
          <div style={{ maxWidth: 720, width:'100%' }}>
            <h1 className="serif" style={{ margin: 0, fontSize: 56, lineHeight: 0.95, letterSpacing:'-0.025em', color: R.INK, fontWeight: 400 }}>
              <span>Pick a </span>
              <span className="serif-italic" style={{ color: R.OLIVE }}>voice.</span>
            </h1>
            <p style={{ margin: '12px 0 28px', fontSize: 15, color: R.INK_SOFT, maxWidth: 520, lineHeight: 1.5 }}>
              You'll bring your own API key. Recommended for speed: Groq. You can switch anytime.
            </p>

            <div style={{ display:'flex', flexDirection:'column', gap: 8 }}>
              {recs.map(r => <VoiceCard key={r.p} {...r} />)}
            </div>

            <div style={{
              marginTop: 22, padding: '14px 16px',
              background: R.OLIVE_SOFT, border: `1px solid ${R.OLIVE}33`, borderRadius: 10,
              display:'flex', gap: 12, alignItems:'flex-start',
            }}>
              <span style={{ color: R.OLIVE_DEEP, display:'inline-flex', flexShrink: 0, marginTop: 2 }}>{I.key({ size: 14 })}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: R.OLIVE_INK, fontWeight: 500 }}>Paste your Groq API key</div>
                <div style={{
                  marginTop: 8, padding: '10px 12px', background: R.CANVAS,
                  border: `1px solid ${R.OLIVE}33`, borderRadius: 7,
                  fontSize: 13, color: R.MUTE, fontFamily: 'JetBrains Mono', letterSpacing:'0.04em',
                }}>gsk_••••••••••••••••••••••••••••••••</div>
                <div style={{ fontSize: 11.5, color: R.OLIVE_INK, opacity: 0.7, marginTop: 6 }}>
                  Stored in your system keychain. Never logged, never sent to us.
                </div>
              </div>
            </div>

            <div style={{ marginTop: 28, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <Btn kind="ghost">Skip for now</Btn>
              <Btn kind="primary">Finish setup{' '}<span style={{ display:'inline-flex' }}>{I.arrowR({ size: 13 })}</span></Btn>
            </div>
          </div>
        </div>
      </div>
    </MacWindow>
  );
}

function VoiceCard({ label, model, sub, selected }) {
  return (
    <div style={{
      background: selected ? R.ELEVATED : 'transparent',
      border: `1px solid ${selected ? R.OLIVE : R.RULE}`,
      borderRadius: 11, padding: '14px 18px',
      display:'flex', alignItems:'center', gap: 16,
    }}>
      <div style={{
        width: 18, height: 18, borderRadius: '50%',
        background: selected ? R.OLIVE : 'transparent',
        border: `1.5px solid ${selected ? R.OLIVE : R.RULE}`,
        display:'inline-flex', alignItems:'center', justifyContent:'center',
        flexShrink: 0,
      }}>
        {selected && <span style={{ width: 6, height: 6, borderRadius:'50%', background: R.CANVAS }} />}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
          <span className="mono" style={{ fontSize: 10, letterSpacing:'0.16em', textTransform:'uppercase', color: R.MUTE }}>{label}</span>
          {selected && (
            <span className="mono" style={{
              fontSize: 9, padding:'2px 6px', background: R.OLIVE, color: R.CANVAS,
              borderRadius: 999, letterSpacing:'0.12em',
            }}>RECOMMENDED</span>
          )}
        </div>
        <div className="serif" style={{ fontSize: 26, color: R.INK, lineHeight: 1.05, marginTop: 2, letterSpacing:'-0.015em' }}>
          {model}
        </div>
        <div style={{ fontSize: 12.5, color: R.MUTE, marginTop: 4 }}>{sub}</div>
      </div>
    </div>
  );
}

Object.assign(window, {
  OnboardingWelcome, OnboardingPermissions, OnboardingVoiceModel,
});
