import type { ConventionRule, PracticeArea, Question } from '../lib/types.ts';

type Pair = { correct: string; incorrect: string };
type PairsByLanguage = Record<string, Pair>;

/**
 * Every seeded rule is tagged *review*, and none is tagged *lint*, *gate* or *CI*.
 *
 * §8.1 says the tag is what tells a reader whether a clean run means anything — so a tag is a
 * claim about tooling, and this wizard configures no linter, no type gate and no CI job. `E1`,
 * `F1`, `I1`, `D1` and `S1` claimed *lint* and `T1` and `X1` claimed *CI* until 2026-09-15,
 * which made a clean run read as evidence it was not.
 *
 * Deriving the tag from `scan.hasCi` was the alternative and is no better: a repo having *a* CI
 * job says nothing about whether that job enforces *this* rule, so it trades one unearned claim
 * for a subtler one. Promote a rule by hand — the generated file says so at the top — once you
 * have configured something that actually catches it.
 */
const SEEDED: ConventionRule['enforcement'] = 'review';

/** Falls back to the generic pair so a language we have no real example for says nothing false. */
function pairFor(pairs: PairsByLanguage, language: string): Pair | null {
  return pairs[language] ?? pairs.generic ?? null;
}

/**
 * Every area in this file is a rule about source code, and every one of them renders into
 * `docs/conventions-<language>.md`. So the condition is applied here, once, rather than copied
 * onto eleven questions: an area added to this file later cannot forget it.
 *
 * The judgement is per question and was made from the options, not the title — `file-naming`
 * ("How are files and folders named?") reads domain-neutral until you read its options, which
 * are kebab-case in TypeScript and initialisms in Go, and `test-policy` reads like a general
 * proof obligation until you read its options, which are `foo.test.ts` and `func TestApplyTax`.
 * Someone doing non-code work answers neither. What they still get asked is
 * `src/questions/practices-policy.ts`, which is unconditioned because copy registers and
 * drive-by fixes are true of a chapter and a spreadsheet as much as of a diff.
 */
function question(
  id: string,
  ask: string,
  options: Question['options'],
  configKey = `practices.${id}`,
): Question {
  return {
    id,
    phase: 'practices',
    kind: 'select',
    ask,
    options,
    readMore: id,
    configKey,
    when: { key: 'workKind', is: 'code' },
  };
}

function ruleFrom(
  spec: Omit<ConventionRule, 'correct' | 'incorrect'>,
  pairs: PairsByLanguage,
  language: string,
): ConventionRule | null {
  const pair = pairFor(pairs, language);
  return pair ? { ...spec, ...pair } : null;
}

const COMMENTS: PracticeArea = {
  target: 'conventions',
  languages: [],
  question: question('comments', 'What may a code comment say?', [
    {
      value: 'why-only',
      label: 'Why only — never what',
      example: '`// the API 404s on an empty cart, so we send one dummy line`',
      recommended: true,
    },
    {
      value: 'why-plus-headers',
      label: 'Why, plus section headers in long files',
      example: 'Same rule, but `// ---- validation ----` banners are allowed',
    },
    {
      value: 'none',
      label: 'No rule',
      example: 'Nothing is written; the agent comments as it sees fit',
    },
  ]),
  rule: (value, language) => {
    if (value === 'none') return null;
    return ruleFrom(
      {
        id: 'C1',
        title: 'Comments say why, never what',
        body:
          'A comment restating the line below it is banned — rename or extract instead. A comment recording *why* is required where the reason is not derivable from the code. **Never bulk-delete comments**, and never strip one in a protected category: product or design rationale, a lint-suppression justification, an external-constraint workaround, or documentation on a public export.' +
          (value === 'why-plus-headers' ? ' Section banners in a long file are exempt.' : ''),
        enforcement: SEEDED,
        provenance: 'OURS',
      },
      {
        generic: {
          correct: '// the vendor API 404s on an empty cart, so we send one dummy line',
          incorrect: '// loop over the items',
        },
        go: {
          correct: '// Retry once: the upstream returns 502 on its first call after a deploy.',
          incorrect: '// increment i',
        },
        python: {
          correct: '# tz is naive here because the vendor sends local time with no offset',
          incorrect: '# set the value to 3',
        },
      },
      language,
    );
  },
};

const FUNCTION_LENGTH: PracticeArea = {
  target: 'conventions',
  languages: [],
  question: question('function-length', 'How long may a function get before it is split?', [
    {
      value: 'house-6-15',
      label: 'Roughly 6–15 lines; extract helpers',
      example: 'A 30-line handler becomes a 10-line handler plus two named helpers',
      recommended: true,
    },
    {
      value: 'typical-20-ceiling-40',
      label: '5–20 typical, 40 a hard ceiling',
      example: 'Looser: a 35-line reducer is fine, a 45-line one is not',
    },
    { value: 'none', label: 'No rule', example: 'Length is left to review' },
  ]),
  rule: (value, language) => {
    if (value === 'none') return null;
    const shape =
      value === 'house-6-15' ? 'roughly 6–15 lines' : '5–20 lines typical, 40 ceiling';
    return ruleFrom(
      {
        id: 'L1',
        title: `Functions stay short — ${shape}`,
        body: `A function that fits on a screen is reviewed at a glance and tested alone. Extract for a *concept*, not to relocate lines: a helper that needs three parameters to explain itself was the wrong cut. Markup and view bodies are exempt from the count.`,
        enforcement: SEEDED,
        provenance: 'OURS',
      },
      {
        generic: {
          correct:
            'function priceWithTax(order) { return applyTax(subtotal(order), order.region); }',
          incorrect:
            'function priceWithTax(order) { /* 40 lines of inlined subtotal and tax */ }',
        },
      },
      language,
    );
  },
};

const EXPORTS: PracticeArea = {
  target: 'conventions',
  languages: ['typescript', 'go', 'swift'],
  question: question('exports', 'How is a module’s public surface declared?', [
    {
      value: 'named-only',
      label: 'Named exports; declarations, not const arrows',
      example:
        '`export function Button(props: ButtonProps)` — default only where a framework demands it',
      recommended: true,
    },
    {
      value: 'default-allowed',
      label: 'Default exports allowed anywhere',
      example: '`export default function Button()` in any file',
    },
    { value: 'none', label: 'No rule', example: 'Whatever the file already does' },
  ]),
  rule: (value, language) => {
    if (value === 'none') return null;
    if (language === 'go') {
      return ruleFrom(
        {
          id: 'E1',
          title: 'Minimize the exported surface',
          body: 'Capitalization *is* the export mechanism. Export an identifier only when something outside the package calls it, and avoid stutter: `helpcontent.Load`, not `helpcontent.LoadHelpContent`.',
          enforcement: SEEDED,
          provenance: 'STANDARD',
        },
        {
          go: {
            correct: 'func Load(ctx context.Context) (*Content, error)  // package helpcontent',
            incorrect: 'func LoadHelpContent(ctx context.Context) (*HelpContent, error)',
          },
        },
        language,
      );
    }
    return ruleFrom(
      {
        id: 'E1',
        title:
          value === 'named-only'
            ? 'Named exports everywhere; exported things are declarations'
            : 'Default exports are permitted',
        body:
          value === 'named-only'
            ? 'Default exports only where the framework requires them (a route file, an entry point). Anything exported is a `function` declaration rather than a `const` arrow, so it hoists, names itself in a stack trace, and is greppable.'
            : 'Either form is acceptable; pick one per file and stay with it.',
        enforcement: SEEDED,
        provenance: 'COMMON',
      },
      {
        generic: {
          correct: 'export function formatMoney(cents: number): string { … }',
          incorrect: 'export default (cents: number) => { … }',
        },
        swift: {
          correct: 'public func formatMoney(_ cents: Int) -> String { … }',
          incorrect: 'public let formatMoney: (Int) -> String = { … }',
        },
      },
      language,
    );
  },
};

const FILE_NAMING: PracticeArea = {
  target: 'conventions',
  languages: [],
  question: question('file-naming', 'How are files and folders named?', [
    {
      value: 'ecosystem-default',
      label: 'Whatever the language’s ecosystem does',
      example: 'kebab-case in TS, snake_case in Go and Python, PascalCase in Swift',
      recommended: true,
    },
    {
      value: 'kebab-everywhere',
      label: 'kebab-case everywhere it is legal',
      example: '`user-profile.ts`, `user-profile.py` — one rule across the repo',
    },
    { value: 'none', label: 'No rule', example: 'Names are left to review' },
  ]),
  rule: (value, language) => {
    if (value === 'none') return null;
    const ecosystem: Record<string, string> = {
      typescript: 'kebab-case',
      go: 'lowercase with underscores',
      python: 'snake_case',
      swift: 'PascalCase, named for the primary type',
      rust: 'snake_case',
    };
    const shape =
      value === 'kebab-everywhere' && language !== 'go' && language !== 'swift'
        ? 'kebab-case'
        : (ecosystem[language] ?? 'kebab-case');
    return ruleFrom(
      {
        id: 'F1',
        title: `Filenames are ${shape}`,
        body: `Acronyms are words, not shouts: \`userId\`, \`apiUrl\`, \`HttpClient\` — except in Go, where initialisms keep uniform case (\`userID\`, \`apiURL\`, \`HTTPClient\`). Where two standards disagree on this, the file extension decides which applies, and both say so.`,
        enforcement: SEEDED,
        provenance: 'COMMON',
      },
      {
        generic: {
          correct: 'src/user-profile/address-book.ts',
          incorrect: 'src/UserProfile/AddressBook.ts',
        },
        go: { correct: 'listing_unit_postgres.go', incorrect: 'listingUnitPostgres.go' },
        python: { correct: 'address_book.py', incorrect: 'addressBook.py' },
        swift: {
          correct: 'AddressBook.swift  // holds `struct AddressBook`',
          incorrect: 'address-book.swift',
        },
      },
      language,
    );
  },
};

const IMPORTS: PracticeArea = {
  target: 'conventions',
  languages: ['typescript', 'python', 'swift'],
  question: question('imports', 'How are imports written and ordered?', [
    {
      value: 'no-parent-relative',
      label: 'No `../`; grouped, blank line between groups',
      example: '`./sibling` is fine; reach for an alias instead of `../../lib/x`',
      recommended: true,
    },
    {
      value: 'grouped-only',
      label: 'Grouped and sorted, relative paths allowed',
      example: 'Order is enforced; `../../lib/x` still permitted',
    },
    { value: 'none', label: 'No rule', example: 'Import order is left to the formatter' },
  ]),
  rule: (value, language) => {
    if (value === 'none') return null;
    return ruleFrom(
      {
        id: 'I1',
        title:
          value === 'no-parent-relative'
            ? 'No parent-relative imports; groups separated by a blank line'
            : 'Imports are grouped and alphabetised within each group',
        body: `${
          value === 'no-parent-relative'
            ? '`./sibling` is fine; anything containing `../` is not — use the path alias. A `../` chain encodes the current file’s position in the tree, so moving the file breaks an import that had nothing to do with the move. '
            : ''
        }Groups: standard library, third party, internal aliases, then relative.`,
        enforcement: SEEDED,
        provenance: 'COMMON',
      },
      {
        generic: {
          correct: "import { formatMoney } from '@/lib/money';",
          incorrect: "import { formatMoney } from '../../../lib/money';",
        },
        python: {
          correct: 'from app.lib.money import format_money',
          incorrect: 'from ...lib.money import format_money',
        },
        swift: {
          correct: 'import Foundation\n\nimport SharedCore',
          incorrect: 'import SharedCore\nimport Foundation',
        },
      },
      language,
    );
  },
};

const TYPES: PracticeArea = {
  target: 'conventions',
  languages: ['typescript', 'python', 'go', 'swift'],
  question: question('types', 'How strict is the type layer?', [
    {
      value: 'strict',
      label: 'Strict — no escape hatches at a boundary',
      example: 'No `any`, no `as unknown as`; string-literal unions instead of `enum`',
      recommended: true,
    },
    {
      value: 'strict-with-escapes',
      label: 'Strict, but escape hatches allowed with a justification comment',
      example: '`any` permitted where a why-comment explains the third-party gap',
    },
    { value: 'none', label: 'No rule', example: 'Only what the compiler already enforces' },
  ]),
  rule: (value, language) => {
    if (value === 'none') return null;
    const bodies: Record<string, string> = {
      typescript:
        '`strict` in one base config, extended by everything. Banned: `any`, `unknown` in props, and `as unknown as`. Prefer string-literal unions to `enum` — an enum is a runtime value pretending to be a type.',
      go: 'No `any` at an API boundary — it defers type checking to runtime. Typed string constants for anything that crosses a wire or a database. Make the zero value useful.',
      python:
        'Type hints on every public function (PEP 484); the checker runs in CI. `Any` only behind a why-comment.',
      swift:
        'No force unwraps or `as!` outside tests. Model absence with `Optional`, not a sentinel.',
    };
    const body = bodies[language];
    if (!body) return null;
    return ruleFrom(
      {
        id: 'T1',
        title: 'The type layer has no silent escape hatches',
        body:
          value === 'strict'
            ? body
            : `${body} An escape hatch is permitted only with a why-comment naming the gap it works around.`,
        enforcement: SEEDED,
        provenance: language === 'python' ? 'STANDARD' : 'OURS',
      },
      {
        typescript: {
          correct: "type Status = 'open' | 'held' | 'done';",
          incorrect: 'enum Status { Open, Held, Done }',
        },
        go: {
          correct: 'type Status string\n\nconst StatusOpen Status = "open"',
          incorrect: 'func Handle(v any) error',
        },
        python: {
          correct: 'def total(items: list[Item]) -> Decimal: ...',
          incorrect: 'def total(items): ...',
        },
        swift: {
          correct: 'guard let user else { return }',
          incorrect: 'let user = maybeUser!',
        },
      },
      language,
    );
  },
};

const LOGIC_PLACEMENT: PracticeArea = {
  target: 'conventions',
  languages: ['typescript', 'go', 'swift', 'python'],
  question: question('logic-placement', 'Where does logic live once a view or handler grows?', [
    {
      value: 'extract-by-concept',
      label: 'Extracted into a named unit, one per file',
      example: 'Two `useState` plus an effect ⇒ a `useMarketCamera` hook in its own file',
      recommended: true,
    },
    {
      value: 'colocate',
      label: 'Colocated until it is reused',
      example: 'Logic stays in the component until a second caller appears',
    },
    { value: 'none', label: 'No rule', example: 'Placement is left to review' },
  ]),
  rule: (value, language) => {
    if (value === 'none') return null;
    const bodies: Record<string, string> = {
      typescript:
        'Extract to a hook when a component has more than two `useState`, any `useEffect` with real work, or logic another component would want. One hook per file, named for the hook. Extract for a *concept*, not to relocate lines.',
      go: 'SQL lives only in `repository/`; controllers and services call it. Errors become HTTP status codes in the handler and nowhere else.',
      swift:
        'Pure logic lives in a shared core module, away from views, and it is the part that gets tests.',
      python:
        'I/O at the edges, pure functions in the middle: a function that both fetches and computes cannot be tested without a network.',
    };
    const body = bodies[language];
    if (!body) return null;
    return ruleFrom(
      {
        id: 'L2',
        title: 'Logic is extracted by concept',
        body,
        enforcement: SEEDED,
        provenance: 'OURS',
      },
      {
        typescript: {
          correct: 'const { frame, capture } = useMarketCamera();',
          incorrect:
            'const [a, setA] = useState(); const [b, setB] = useState(); useEffect(() => { /* 30 lines */ });',
        },
        go: {
          correct: 'rows, err := r.db.Query(ctx, `SELECT …`)  // repository/listing.go',
          incorrect: 'rows, err := c.db.Query(ctx, `SELECT …`)  // controller/listing.go',
        },
        swift: {
          correct: 'Shared/Core/WindowSchedule.swift — pure, tested',
          incorrect: 'the same date maths inline in a SwiftUI `body`',
        },
        python: {
          correct: 'def summarize(rows: list[Row]) -> Summary: ...',
          incorrect: 'def summarize(): rows = requests.get(...).json() ...',
        },
      },
      language,
    );
  },
};

const DATA_LAYER: PracticeArea = {
  target: 'conventions',
  languages: ['typescript', 'go', 'python'],
  question: question(
    'data-layer',
    'How does application code reach the network or the database?',
    [
      {
        value: 'one-client',
        label: 'One typed client; raw calls banned in app code',
        example: '`api.listings.get(id)` — a bare `fetch()` in a component fails review',
        recommended: true,
      },
      {
        value: 'library-default',
        label: 'A single agreed library, called directly',
        example: 'Everyone uses the same fetching library; no wrapper layer',
      },
      { value: 'none', label: 'No rule', example: 'Each feature chooses' },
    ],
  ),
  rule: (value, language) => {
    if (value === 'none') return null;
    return ruleFrom(
      {
        id: 'D1',
        title:
          value === 'one-client'
            ? 'One typed client; raw calls are banned in app code'
            : 'One agreed data library',
        body:
          (value === 'one-client'
            ? 'Every network and database call goes through one typed client; a bare `fetch` or a raw driver call in app code fails review, because the client is the one place retries, auth, error shape and types are decided. '
            : 'Every call goes through the one agreed library, called directly — no wrapper layer, and no second library either. ') +
          'Environment variables are read and validated once at startup and passed down — never read inline in app code, where a missing value surfaces as a runtime undefined three layers away from the cause.',
        enforcement: SEEDED,
        provenance: 'OURS',
      },
      {
        generic: {
          correct: 'const listing = await api.listings.get(id);',
          // biome-ignore lint/suspicious/noTemplateCurlyInString: example code shown to the reader
          incorrect: 'await fetch(`/api/listings/${id}`).then((r) => r.json())',
        },
        go: {
          correct: 'row := r.db.QueryRow(ctx, q, id)  // repository/',
          incorrect: 'row := db.QueryRow(context.Background(), q, id)  // service/',
        },
        python: {
          correct: 'client.listings.get(listing_id)',
          incorrect: 'requests.get(f"{os.environ[\'API\']}/listings/{id}")',
        },
      },
      language,
    );
  },
};

const STATES: PracticeArea = {
  target: 'conventions',
  languages: ['typescript', 'swift'],
  question: question('states', 'What must a screen that loads data render?', [
    {
      value: 'all-three',
      label: 'Loading, error and empty — all three, mandatory',
      example: 'One `DataState` wrapper; a screen with no empty state fails review',
      recommended: true,
    },
    {
      value: 'per-screen',
      label: 'Required, but each screen writes its own',
      example: 'No shared component; consistency is a review matter',
    },
    { value: 'none', label: 'No rule', example: 'States are added when someone notices' },
  ]),
  rule: (value, language) =>
    value === 'none'
      ? null
      : ruleFrom(
          {
            id: 'D2',
            title: 'Loading, error and empty states are mandatory',
            body:
              value === 'all-three'
                ? 'All three render through one shared component, so a screen cannot ship with two of them. The empty state is the one that gets skipped, and it is the one a new user sees first.'
                : 'All three are required on every data-backed screen; the implementation is the screen’s own.',
            enforcement: SEEDED,
            provenance: 'OURS',
          },
          {
            generic: {
              correct: '<DataState query={q} empty={<NoListings />}>{(rows) => …}</DataState>',
              incorrect:
                'if (isLoading) return <Spinner />;  // and nothing for error or empty',
            },
            swift: {
              correct:
                'switch state { case .loading: …; case .failed(let e): …; case .empty: …; case .loaded(let x): … }',
              incorrect: 'if isLoading { ProgressView() } else { List(items) }',
            },
          },
          language,
        ),
};

const DESIGN_TOKENS: PracticeArea = {
  target: 'conventions',
  languages: ['typescript', 'swift'],
  question: question(
    'design-tokens',
    'How are colours, spacing and radii written in view code?',
    [
      {
        value: 'tokens-only',
        label: 'Role-named tokens only; literals banned',
        example: '`bg-primary`, `Theme.cardRadius` — never `#5B8C5A` or `radius: 14`',
        recommended: true,
      },
      {
        value: 'tokens-with-escape',
        label: 'Tokens, with a documented escape hatch',
        example: 'A literal is allowed with a comment naming why no token fits',
      },
      { value: 'none', label: 'No rule', example: 'Values are written inline' },
    ],
  ),
  rule: (value, language) =>
    value === 'none'
      ? null
      : ruleFrom(
          {
            id: 'S1',
            title: 'Design tokens, never literals',
            body:
              'Role-named tokens with one swap point per platform, so a redesign is one edit rather than a repo-wide find-and-replace. Every platform in the repo defaults to the OS colour scheme; a colour that cannot resolve per scheme is not a token.' +
              (value === 'tokens-with-escape'
                ? ' A raw value is permitted with a comment naming why no token fits.'
                : ''),
            enforcement: SEEDED,
            provenance: 'OURS',
          },
          {
            generic: {
              correct: 'className="bg-surface border-line"',
              incorrect: 'className="bg-[#F7F3E8] border-[#D9CDB4]"',
            },
            swift: {
              correct: 'Theme.cream, Theme.cardRadius',
              incorrect: 'Color(hex: "F7F3E8"), cornerRadius: 14',
            },
          },
          language,
        ),
};

const TEST_POLICY: PracticeArea = {
  target: 'conventions',
  languages: [],
  question: question('test-policy', 'What does a change owe in tests?', [
    {
      value: 'new-file-per-feature',
      label: 'Pure logic is tested, in a new file named for the feature',
      example: 'Two sessions adding tests never collide in the same suite file',
      recommended: true,
    },
    {
      value: 'colocated',
      label: 'Colocated `foo.test.*` beside the source',
      example: '`money.ts` and `money.test.ts` side by side',
    },
    { value: 'none', label: 'No rule', example: 'Tests are written when someone decides to' },
  ]),
  rule: (value, language) =>
    value === 'none'
      ? null
      : ruleFrom(
          {
            id: 'X1',
            title:
              value === 'new-file-per-feature'
                ? 'Pure logic gets tests, in a new file named for the feature'
                : 'Tests are colocated beside their source',
            body:
              value === 'new-file-per-feature'
                ? 'A new file rather than an addition to an existing suite, so two sessions working in parallel do not collide in one file. Write characterization tests *before* moving logic, not after — a test written after the move proves the new shape, not that the behaviour survived.'
                : 'Each source file’s tests sit beside it, discovered by the runner’s include glob.',
            enforcement: SEEDED,
            provenance: 'COMMON',
          },
          {
            generic: {
              correct: 'tests/checkout-tax.test.ts  — new file, named for the feature',
              incorrect: 'a 40th case appended to tests/misc.test.ts',
            },
            go: {
              correct: 'func TestApplyTax(t *testing.T) { … }  // table-driven, t.Run subtests',
              incorrect: 'one Test func asserting six unrelated behaviours',
            },
            python: {
              correct: 'tests/test_checkout_tax.py',
              incorrect: 'a new case inside tests/test_misc.py',
            },
          },
          language,
        ),
};

export const CODE_AREAS: PracticeArea[] = [
  COMMENTS,
  FUNCTION_LENGTH,
  EXPORTS,
  FILE_NAMING,
  IMPORTS,
  TYPES,
  LOGIC_PLACEMENT,
  DATA_LAYER,
  STATES,
  DESIGN_TOKENS,
  TEST_POLICY,
];
