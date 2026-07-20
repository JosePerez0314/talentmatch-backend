# Lógica de Calificación — Match Score de Candidatos

> Cómo TalentMatch AI convierte un CV y una Posición en un `matchScore` determinista de 0 a 100.

**Fuente de verdad:** `src/utils/scoringEngine.ts`
**Invocador:** `src/controllers/vacancies.controller.ts` → `evaluateCandidates`
**Persistido en:** `MatchResult` (`prisma/schema.prisma`)

---

## Índice

1. [Visión general](#1-visión-general)
2. [Dónde encaja la calificación en el pipeline](#2-dónde-encaja-la-calificación-en-el-pipeline)
3. [Entradas y contratos](#3-entradas-y-contratos)
4. [Distribución de pesos](#4-distribución-de-pesos)
5. [Lógica componente por componente](#5-lógica-componente-por-componente)
   - [5.1 Hard Skills — 30%](#51-hard-skills--30)
   - [5.2 Experiencia — 20%](#52-experiencia--20)
   - [5.3 Rol — 15%](#53-rol--15)
   - [5.4 Idiomas — 15%](#54-idiomas--15)
   - [5.5 Educación — 10%](#55-educación--10)
   - [5.6 Soft Skills — 10%](#56-soft-skills--10)
6. [La salida: `MatchScoreResult`](#6-la-salida-matchscoreresult)
7. [Persistencia y redondeo](#7-persistencia-y-redondeo)
8. [Ejemplos resueltos](#8-ejemplos-resueltos)
9. [Invariantes de diseño](#9-invariantes-de-diseño)
10. [Huecos conocidos y casos borde](#10-huecos-conocidos-y-casos-borde)

---

## 1. Visión general

El motor de calificación es **determinista por diseño**. El LLM nunca asigna el puntaje — únicamente *estructura* el texto no estructurado del CV en un perfil JSON normalizado. Una vez que ese JSON existe, el puntaje es aritmética pura:

```
matchScore = hardSkills + experiencia + rol + idiomas + educación + softSkills
```

Cada término está acotado por su propio peso, así que la suma queda dentro de `[0, 100]` y se redondea una sola vez al final.

Esta separación existe para que:

- El mismo candidato con la misma posición produzca siempre el mismo puntaje (auditable, reproducible).
- Un cambio de modelo o de prompt no pueda alterar silenciosamente el ranking.
- Al reclutador se le muestre un **desglose**, no un número de caja negra.

---

## 2. Dónde encaja la calificación en el pipeline

```
POST /api/vacancies/:id/upload
  └─ PDF → Cloudinary
     └─ pdf-parse → texto crudo
        └─ control de calidad (< 500 caracteres → rechazado)
           └─ dedup por hash SHA-256 (por usuario)
              └─ extracción con OpenAI → fila Candidate
                 └─ fila Application (candidato ↔ vacante)

POST /api/vacancies/:id/evaluations     ← paso separado y explícito
  └─ carga las Applications pendientes (sin MatchResult para esta vacante)
     └─ concurrencia p-limit(5)
        ├─ matchEngine()          ← OpenAI: normaliza candidato contra posición
        └─ calculateMatchScore()  ← ESTE DOCUMENTO: puro, síncrono, sin I/O
           └─ prisma.matchResult.create()
```

Dos puntos a destacar:

- **La carga y la evaluación están desacopladas.** Subir un CV nunca lo califica. La evaluación se dispara explícitamente, y eso es justamente lo que permite que un candidato reutilizado en varias vacantes (mismo hash de CV, mismo usuario) sea calificado de forma independiente en cada una.
- `calculateMatchScore` es **puro**: sin `await`, sin base de datos, sin red. Es trivialmente testeable y seguro de ejecutar dentro del limitador de concurrencia.

Aislamiento de fallos: cada candidato se evalúa dentro de su propio `try/catch`. Si la normalización con OpenAI falla para uno, ese candidato devuelve un objeto de error dentro del arreglo de resultados; el resto del lote se completa igual y el endpoint sigue respondiendo `201`.

---

## 3. Entradas y contratos

`calculateMatchScore(position, normalizedCandidate)` recibe dos objetos.

### Position (la línea base del requerimiento)

```ts
interface Position {
  technicalSkills: string[];
  yearsOfExperience: number;
  role: string;
  languages: string[];
  educationLevel: string;
  educationArea: string;
  softSkills: string[];
}
```

Construido por `positionEngineSelectObject(vacancy.position)` en el controlador.

### Normalized Candidate (el perfil estructurado por la IA)

```ts
interface Candidate {
  technicalSkills: string[];
  yearsOfExperience: number;
  role: string;
  languages: string[];
  educationLevel: string;
  educationArea: string;
  softSkills: string[];
  aiAnalysis?: {
    projectHighlights?: string[];
  };
}
```

Producido por `matchEngine()` (`src/prompts/matchEngine.prompt.ts`), que llama a la Responses API de OpenAI con un prompt ID almacenado y devuelve JSON parseado conforme a `NormalizedCandidate`.

### Cláusula de guarda

```ts
if (!position || !normalizedCandidate) return { totalScore: 0, breakdown };
```

Si falta alguno de los dos lados el resultado es `0` con un **breakdown vacío** — no un breakdown lleno de ceros. Los consumidores no deben asumir que `breakdown.technical` existe cuando el puntaje es cero.

---

## 4. Distribución de pesos

```ts
const WEIGHTS = {
  TECHNICAL_SKILLS: 0.30,
  EXPERIENCE:       0.20,
  ROLE:             0.15,
  LANGUAGES:        0.15,
  EDUCATION:        0.10,
  SOFT_SKILLS:      0.10,
};
```

| Componente | Peso | Puntos máx. | Forma |
|---|---:|---:|---|
| Habilidades técnicas (hard) | 30% | 30 | Ratio lineal |
| Experiencia | 20% | 20 | Umbral + fallback |
| Rol | 15% | 15 | Binario |
| Idiomas | 15% | 15 | Ratio lineal |
| Educación | 10% | 10 | Escalera ordinal, proporcional |
| Soft skills | 10% | 10 | Ratio lineal |
| **Total** | **100%** | **100** | |

Los pesos se multiplican por `100` dentro del motor (`WEIGHTS.X * 100`), así que cada componente se expresa directamente en puntos, no en fracciones.

---

## 5. Lógica componente por componente

### 5.1 Hard Skills — 30%

```ts
const matchedTech = position.technicalSkills.filter(skill =>
  candidateTechSkillsLower.includes(skill.toLowerCase())
);

techScore = position.technicalSkills.length > 0
  ? (matchedTech.length / position.technicalSkills.length) * 30
  : 30;
```

- **La dirección importa:** el motor itera sobre las habilidades requeridas *por la posición* y pregunta si el candidato tiene cada una. Las habilidades adicionales que el candidato posee y que la posición nunca pidió no aportan nada. Es intencional — el puntaje mide *ajuste al requerimiento*, no amplitud bruta.
- La comparación es **igualdad exacta de cadenas, insensible a mayúsculas**. `"Node.js"` coincide con `"node.js"`, pero no con `"NodeJS"` ni con `"Node"`. Normalizar esa variación es trabajo del LLM aguas arriba.
- **Requerimiento vacío → crédito completo.** Una posición sin habilidades técnicas listadas otorga los 30 puntos a todos los candidatos.
- `matched` se devuelve en el breakdown para que la UI pueda mostrar *cuáles* habilidades coincidieron.

### 5.2 Experiencia — 20%

Tres ramas, evaluadas en orden:

```ts
if (candidate.yearsOfExperience >= position.yearsOfExperience) {
  expScore = 20;                                   // (a) cumple el umbral
} else if (highlights.length > 0) {
  expScore = 10;                                   // (b) el "salvavidas"
} else {
  expScore = position.yearsOfExperience > 0
    ? (candidate.yearsOfExperience / position.yearsOfExperience) * 20
    : 0;                                           // (c) proporcional
}
```

**(a) Cumple o supera** → 20 completos. No hay bonificación por exceder: 10 años contra un requerimiento de 3 puntúa igual que 3.

**(b) El "salvavidas".** Un candidato que no llega a los años formales pero cuyo `aiAnalysis.projectHighlights` no está vacío recibe 10 puntos planos en lugar de una penalización proporcional cruda. La intención es evitar el rechazo automático de perfiles autodidactas o con fuerte carga de proyectos — alguien en cambio de carrera con dos proyectos serios entregados y un año de experiencia formal no es lo mismo que alguien con un año y nada que mostrar.

Nótese que la condición es de **presencia, no de calidad**: un solo string en el arreglo basta para dispararla. El motor no lee los highlights; solo los cuenta.

**(c) Fallback proporcional.** Sin highlights → ratio lineal contra el requerimiento. Si la posición exige `0` años y el candidato de algún modo llega a esta rama, el puntaje es `0` — pero es inalcanzable en la práctica, ya que `candidate.yearsOfExperience >= 0` siempre satisface la rama (a) cuando el requerimiento es `0`.

### 5.3 Rol — 15%

```ts
roleScore = candidate.role.toLowerCase() === position.role.toLowerCase() ? 15 : 0;
```

Estrictamente binario y estrictamente exacto (insensible a mayúsculas). `"Backend Developer"` contra `"Backend Engineer"` puntúa **0** — un acantilado de 15 puntos solo por la redacción.

Esto pone peso real sobre el LLM para que normalice el título del candidato hacia el vocabulario de la posición durante el paso `matchEngine`. Es el componente más frágil del motor.

### 5.4 Idiomas — 15%

Forma idéntica a las hard skills:

```ts
lanScore = position.languages.length > 0
  ? (matchedLan.length / position.languages.length) * 15
  : 15;
```

Dirigido por la posición, coincidencia exacta insensible a mayúsculas, requerimiento vacío → crédito completo. El nivel de dominio no está modelado — un idioma está presente o ausente.

### 5.5 Educación — 10%

Educación es el único componente que usa una **escalera ordinal**:

```ts
const EDUCATION_LEVELS = {
  NONE: 0,
  HIGH_SCHOOL: 1,
  BACHELOR: 2,
  TECHNICAL: 3,
  UNIVERSITY: 4,
  MASTER: 5,
  DOCTORATE: 6,
};
```

La búsqueda es insensible a mayúsculas y con valor por defecto seguro:

```ts
const getEducationLevel = (education: string) =>
  EDUCATION_LEVELS[education.toUpperCase()] ?? 0;
```

Cualquier cadena no reconocida — incluido el literal `"NONE"` — resuelve a `0` en lugar de lanzar una excepción.

```ts
educationScore =
  positionEduLevel === 0 || candidateEduLevel >= positionEduLevel
    ? 10
    : (candidateEduLevel / positionEduLevel) * 10;
```

- **Sin requerimiento** (`positionEduLevel === 0`) → 10 completos.
- **Cumple o supera** → 10 completos.
- **Por debajo** → **proporcional, no cero.** Un candidato `HIGH_SCHOOL` (1) contra un requerimiento `UNIVERSITY` (4) obtiene `1/4 * 10 = 2.5` puntos. La educación degrada con gracia; nunca guillotina.

`educationArea` está presente en ambas interfaces pero **el motor no la lee**. La relevancia del área de estudio actualmente no se califica.

### 5.6 Soft Skills — 10%

Misma forma de ratio lineal que hard skills e idiomas: dirigido por la posición, insensible a mayúsculas, requerimiento vacío → crédito completo.

---

## 6. La salida: `MatchScoreResult`

```ts
interface MatchScoreResult {
  totalScore: number;                                              // redondeado 0–100
  breakdown: Record<string, { score: number; matched?: unknown[] }>;
}
```

Claves de `breakdown`, en orden de inserción: `technical`, `experience`, `role`, `languages`, `education`, `softSkills`.

Solo los tres componentes de intersección de conjuntos incluyen `matched`:

| Clave | `score` | `matched` |
|---|---|---|
| `technical` | 0–30 | habilidades requeridas que el candidato tiene |
| `experience` | 0–20 | — |
| `role` | 0 o 15 | — |
| `languages` | 0–15 | idiomas requeridos que el candidato tiene |
| `education` | 0–10 | — |
| `softSkills` | 0–10 | soft skills requeridas que el candidato tiene |

`totalScore` es `Math.round(finalScore)` — se redondea **una sola vez**, a partir de la suma sin redondear.

---

## 7. Persistencia y redondeo

El controlador aplana el breakdown en columnas de `MatchResult`:

```ts
matchScore:       match.totalScore,
educationScore:   Math.round(match.breakdown.education.score),
experienceScore:  Math.round(match.breakdown.experience.score),
hardSkillsScore:  Math.round(match.breakdown.technical.score),
languagesScore:   Math.round(match.breakdown.languages.score),
roleScore:        Math.round(match.breakdown.role.score),
softSkillsScore:  Math.round(match.breakdown.softSkills.score),
```

⚠️ **Los componentes almacenados no siempre suman exactamente `matchScore`.** `matchScore` redondea el total una vez; cada componente redondea de forma independiente. Con seis componentes, el redondeo acumulado puede desviar la suma de columnas respecto a `matchScore` hasta en ±3 puntos. No trates la suma de columnas como una suma de verificación, y no recalcules el total desde las columnas en la UI — muestra `matchScore` directamente.

También se persiste junto a los números:

- `normalizedCandidate` — el JSON completo normalizado por la IA, guardado como **instantánea de auditoría** para poder explicar una evaluación pasada incluso después de que la fila `Candidate` original cambie.
- `redFlags`, `summary` — extraídos de `aiAnalysis`; son narrativos, nunca se califican.

`MatchResult` lleva `@@unique([candidateId, vacancyId])`, así que un candidato se califica como máximo una vez por vacante. Reejecutar la evaluación solo toma las Applications que no tienen todavía un `MatchResult` para esa vacante.

---

## 8. Ejemplos resueltos

**Posición:** rol `"Backend Node.js Developer"`, 3 años, skills `[Node.js, Express, MySQL, TypeScript]`, idiomas `[Spanish, English]`, soft `[Communication, Problem Solving]`, educación `UNIVERSITY`.

### Candidato fuerte

4 años · las 4 skills · rol exacto · ambos idiomas · ambas soft skills · `UNIVERSITY`

| Componente | Cálculo | Puntos |
|---|---|---:|
| Hard skills | 4/4 × 30 | 30 |
| Experiencia | 4 ≥ 3 → completo | 20 |
| Rol | coincidencia exacta | 15 |
| Idiomas | 2/2 × 15 | 15 |
| Educación | 4 ≥ 4 → completo | 10 |
| Soft skills | 2/2 × 10 | 10 |
| **Total** | | **100** |

### Candidato parcial (ruta salvavidas)

1 año · 2/4 skills · rol exacto · ambos idiomas · 1/2 soft skills · `UNIVERSITY` · con `projectHighlights`

| Componente | Cálculo | Puntos |
|---|---|---:|
| Hard skills | 2/4 × 30 | 15 |
| Experiencia | 1 < 3, hay highlights → plano | 10 |
| Rol | coincidencia exacta | 15 |
| Idiomas | 2/2 × 15 | 15 |
| Educación | 4 ≥ 4 → completo | 10 |
| Soft skills | 1/2 × 10 | 5 |
| **Total** | | **70** |

Sin el salvavidas, la experiencia habría sido `1/3 × 20 = 6.67` y el total `67`.

### Candidato débil

1 año · 0/4 skills · rol `"Frontend Developer"` · 1/2 idiomas · 0/2 soft skills · `HIGH_SCHOOL` · sin highlights

| Componente | Cálculo | Puntos |
|---|---|---:|
| Hard skills | 0/4 × 30 | 0 |
| Experiencia | 1/3 × 20 | 6.67 |
| Rol | no coincide | 0 |
| Idiomas | 1/2 × 15 | 7.5 |
| Educación | 1/4 × 10 | 2.5 |
| Soft skills | 0/2 × 10 | 0 |
| **Total** | `16.67` → redondeo | **17** |

---

## 9. Invariantes de diseño

Mantener estas reglas al modificar el motor:

1. **Pureza.** Sin I/O, sin `await`, sin `Date.now()`, sin aleatoriedad. Mismas entradas → misma salida, siempre.
2. **La IA nunca califica.** El único trabajo del LLM es estructurar texto. Si un cambio hace que el modelo produzca un número que llegue a `finalScore`, la garantía de determinismo desaparece.
3. **Los pesos suman 1.0.** Agregar un componente implica quitarle peso a otro. Una suma superior a 1.0 pasada por alto permite puntajes mayores a 100.
4. **Dirección dirigida por el requerimiento.** Siempre iterar los arreglos de la posición y consultar los del candidato. Invertirlo mide amplitud en lugar de ajuste.
5. **Redondear una sola vez, al final.** Nunca redondear puntajes de componentes intermedios dentro del motor.
6. **Degradar, no guillotinar.** Todos los componentes actuales escalan proporcionalmente o son binarios por diseño explícito (rol). Introducir un cero duro es una decisión de producto, no una refactorización.

---

## 10. Huecos conocidos y casos borde

Documentados tal como se observan en el código — **no** son bugs a corregir en silencio; cada uno es una decisión de producto que hay que tomar deliberadamente.

**La "guillotina" no está implementada.** Las notas del proyecto describen una regla que penaliza fuertemente la ausencia de una hard skill *obligatoria*. El motor no tiene esa rama: las hard skills son un ratio lineal plano sin ningún concepto de habilidad obligatoria. Un candidato al que le falta el requisito más crítico solo pierde su porción proporcional (p. ej. 7.5 de 30 con cuatro skills requeridas) y aún puede puntuar bien en el total.

**Los requerimientos vacíos otorgan crédito completo.** Una posición con `technicalSkills: []`, `languages: []` y `softSkills: []` entrega 55 puntos a cualquier candidato antes de evaluar nada. Las posiciones poco completadas inflan los puntajes de forma generalizada y comprimen el ranking.

**El orden de la escalera educativa es cuestionable.** `BACHELOR: 2` queda *por debajo* de `TECHNICAL: 3` y `UNIVERSITY: 4`. Según la lectura que se pretenda de estas etiquetas, un grado de bachiller podría estar valorado por debajo de una titulación técnica. Cualquier cambio aquí desplaza todas las comparaciones históricas, así que requiere una decisión explícita.

**El salvavidas puede puntuar *más bajo* que la ruta proporcional.** Los 10 puntos planos se aplican siempre que existan highlights, incluso cuando el ratio habría pagado más. Un candidato con 2.5 de 3 años requeridos obtiene `2.5/3 × 20 = 16.67` sin highlights, pero solo `10` con ellos — tener proyectos destacados le cuesta 6.67 puntos. Un `Math.max` entre ambas ramas eliminaría la penalización.

**El rol es un acantilado de 15 puntos por redacción.** La igualdad exacta de cadenas hace que cualquier variación en el título anule el componente. El motor depende por completo de la normalización del LLM aguas arriba para este caso.

**`educationArea` y `optionalTechnicalSkills` se recopilan pero no se califican.** Ambos se extraen, se almacenan y se pasan al motor, pero ninguna rama los lee. La relevancia del área de estudio y las habilidades deseables no aportan nada actualmente.

**El dominio de idiomas es binario.** Presente o ausente; sin distinción A1–C2 ni nativo/fluido.

**`redFlags` no penaliza.** `aiAnalysis.redFlags` se persiste y se muestra al reclutador, pero nunca afecta el puntaje.

---

## Documentos relacionados

- `docs/es/backend-documentation.md` — referencia completa de arquitectura
- `docs/es/api-documentation.md` — contrato de endpoints, incluyendo `POST /api/vacancies/:id/evaluations`
- `docs/es/context/scoring-engine.md` — prompt de contexto/persona condensado
- `docs/en/scoring-logic.md` — versión en inglés de este documento
