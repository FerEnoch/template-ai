# PRD MVP — template-ai

## 1. Resumen ejecutivo

`template-ai` es una aplicación web en español orientada, en su primera versión, a abogados que redactan contratos y escritos judiciales repetitivos. El producto permite transformar documentos formales existentes en plantillas reutilizables: el usuario sube un documento, el sistema detecta el texto completo, propone la estructura fija y los datos particulares del caso, el usuario valida y ajusta esa propuesta, guarda la plantilla en su biblioteca personal y luego puede generar nuevos documentos completando un formulario.

El objetivo del MVP no es “redactar con IA” de forma libre, sino **estandarizar documentos repetitivos con revisión humana obligatoria**, reduciendo tiempo operativo y errores al completar datos variables, manteniendo además el formato del documento original lo mejor posible. Para minimizar fricción, el MVP se ofrecerá como un servicio integrado bajo suscripción: el usuario no deberá configurar API keys ni proveedores externos.

Dado que el producto procesará documentos potencialmente confidenciales, el MVP debe explicar en lenguaje simple qué se almacena, por cuánto tiempo, cómo se usa el contenido para prestar el servicio y cómo puede eliminarlo el usuario. La confianza no depende solo de detectar bien los datos, sino también de tratar los documentos con reglas claras y previsibles.

---

## 2. Problema

Profesionales del derecho y perfiles afines redactan con frecuencia documentos formales que siguen una estructura estable, pero exigen reemplazar datos específicos de cada caso. Hoy ese trabajo suele resolverse mediante:

- copiar y pegar documentos anteriores;
- editar a mano nombres, fechas, domicilios, montos, expedientes y otros datos;
- revisar varias veces para evitar errores;
- rehacer formato o corregir desajustes del documento final.

Esto genera dolores concretos:

- pérdida de tiempo en tareas repetitivas;
- errores por omisión o reemplazos incompletos;
- baja reutilización sistemática de plantillas;
- dependencia de conocimiento operativo no estructurado;
- desconfianza hacia herramientas de IA que no explican qué detectaron ni cómo completaron el documento.

---

## 3. Usuario objetivo del MVP

### Usuario principal
- **Abogados** que redactan:
  - contratos repetitivos;
  - escritos judiciales repetitivos.

### Características del usuario
- Trabaja con documentos formales y de estilo legal.
- Necesita control total sobre el resultado final.
- Tolera una revisión adicional si eso mejora la confianza.
- No quiere lidiar con complejidad técnica ni terminología confusa.
- Valora más la precisión de los datos variables que la “magia” de una IA.

---

## 4. Propuesta de valor

**Subí un documento legal que ya usás, validá qué partes son fijas y cuáles cambian según el caso, guardalo como plantilla y después generá nuevos documentos completando un formulario claro, con edición final y descarga en formatos útiles.**

El producto no reemplaza la revisión profesional del abogado: propone, estructura y acelera, pero el usuario siempre valida antes de guardar una plantilla o descargar un documento.

### Valor principal
1. Detectar correctamente los datos variables.
2. Ahorrar tiempo en redacción repetitiva.
3. Mantener el control humano en todo momento.
4. Reutilizar documentos previos como base de trabajo.
5. Preservar el formato del original al generar el documento final.

---

## 5. Objetivos del MVP

### Objetivos de negocio
- Validar que existe interés real en convertir documentos legales existentes en plantillas reutilizables.
- Validar que abogados aceptan un flujo con revisión humana obligatoria si mejora velocidad y confianza.
- Validar que contratos y escritos judiciales repetitivos son una entrada suficientemente concreta para comenzar.
- Validar que un modelo de suscripción simple, con uso incluido y límites visibles, resulta entendible y aceptable para un posicionamiento de utilitario accesible.

### Objetivos de producto
- Permitir crear una plantilla a partir de un documento existente.
- Permitir revisar y corregir la detección de partes variables.
- Permitir guardar la plantilla en una biblioteca personal.
- Permitir generar un nuevo documento completando un formulario derivado de la plantilla.
- Permitir editar cualquier párrafo del contenido final antes de descargar.
- Permitir descargar el resultado en texto plano, ODF o PDF.
- Ocultar al usuario la complejidad operativa del modelo, evitando configuraciones técnicas innecesarias.
- Permitir que un usuario nuevo entienda rápidamente si su documento es apto para crear una plantilla.
- Ofrecer una salida clara y honesta cuando el análisis no sea suficientemente confiable.
- Transmitir confianza sobre confidencialidad, almacenamiento y eliminación de documentos.

---

## 6. Modelo de acceso y monetización del MVP

### Enfoque general
El MVP se ofrecerá como un **utilitario accesible por suscripción**, con una experiencia integrada de punta a punta.

### Decisiones de acceso
- El usuario **no** deberá ingresar ni administrar una API key propia.
- `template-ai` actuará como intermediario del uso del modelo dentro del servicio.
- El acceso al producto se resolverá con **un único plan** de suscripción en el MVP.

### Principios del modelo comercial
- La experiencia debe sentirse como un producto cerrado y profesional, no como un “wrapper” técnico.
- El usuario debe entender con claridad qué incluye su plan.
- Los límites de uso deben ser **visibles y comprensibles** dentro de la experiencia.
- El modelo debe privilegiar simplicidad de contratación y previsibilidad para el usuario.

### Qué implica en UX
- Mostrar consumo o disponibilidad de uso en lenguaje simple.
- Evitar referencias a tokens, proveedores o configuraciones de infraestructura.
- Comunicar límites en términos cercanos al trabajo real del usuario, por ejemplo documentos, análisis o generaciones.

### Definición operativa pendiente antes de diseño final
Antes de cerrar mockups de alta fidelidad, el producto debe terminar de definir:
- cuál es la unidad principal de consumo del plan;
- si el límite es mensual o bajo otra lógica temporal;
- qué ocurre exactamente cuando el usuario llega al límite;
- si existe o no período de gracia;
- cómo se comunica ese estado dentro del flujo principal.

---

## 7. No objetivos del MVP

Quedan explícitamente fuera del MVP:

- biblioteca compartida entre equipos;
- colaboración multiusuario en tiempo real;
- editor de formato avanzado;
- automatizaciones masivas por lote;
- generación libre de documentos desde cero sin documento base;
- lógica condicional compleja que reestructure por completo un documento;
- visualización gráfica estilo Obsidian de entidades y relaciones como interfaz principal;
- foco en verticales fuera del ámbito legal;
- configuración de API keys o credenciales externas por parte del usuario;
- garantía de equivalencia visual exacta entre documento original y documento exportado;
- soporte para documentos manuscritos, escaneos de baja calidad o archivos no legibles;
- versionado avanzado de plantillas.

---

## 8. Principios de producto y UX

1. **Revisión humana obligatoria siempre**
   - El sistema propone, el usuario valida.

2. **Lenguaje simple en español**
   - Evitar jerga técnica como “placeholders”, “schemas” o “tokens”.
   - Priorizar términos como “datos del caso”, “partes del documento” y “secciones”.

3. **Confianza antes que automatización total**
   - Siempre mostrar qué se detectó.
   - Siempre permitir corrección.

4. **Control editorial final**
   - El usuario puede editar cualquier párrafo del contenido final antes de descargar.
   - No se edita manualmente el formato en el MVP.

5. **Modelo mental basado en entidades, interfaz simple**
   - Internamente conviene pensar en entidades y relaciones.
   - En la UI del MVP se mostrará como lista estructurada de entidades y datos, no como grafo visual.

6. **La complejidad operativa debe permanecer oculta**
   - El usuario no configura proveedores, modelos ni credenciales.
   - La experiencia debe sentirse integrada, simple y profesional.

7. **Límites visibles, pero comprensibles**
   - Si existe un límite de uso, debe explicarse con lenguaje claro y sin jerga técnica.
   - El usuario debe poder anticipar si puede seguir trabajando sin sorpresas.

8. **Confidencialidad y control de almacenamiento**
   - El usuario debe entender qué se guarda, por cuánto tiempo y cómo puede eliminarlo.

9. **Fallback honesto ante baja confianza**
   - Si el sistema no puede detectar con suficiente claridad, debe decirlo y ofrecer una salida concreta.

10. **Trazabilidad visible**
   - Cada dato detectado debe poder vincularse con su origen en el documento cuando sea relevante para la revisión.

11. **La incertidumbre se muestra, no se oculta**
   - El producto debe diferenciar entre detección segura y detección dudosa.

---

## 9. Alcance funcional del MVP

### 9.1. Ingesta de documentos
El usuario puede subir un archivo local a la web.

Formatos aceptados:
- texto plano;
- JPG;
- PDF;
- DOC.

El producto debe informar de forma visible si un archivo no es apto para el flujo del MVP por legibilidad, calidad o estructura.

### 9.2. Extracción de contenido
El sistema debe:
- detectar el texto completo del documento;
- usar OCR si el contenido no es texto seleccionable;
- identificar estructura textual y visual relevante del documento original.

Si la calidad del archivo no permite una extracción confiable, el sistema debe informarlo antes de continuar y ofrecer una salida clara.

### 9.3. Detección de template y datos variables
El sistema debe proponer:
- qué partes del documento son fijas;
- qué partes corresponden a datos particulares del caso;
- agrupación de esos datos por entidades lógicas cuando sea posible.

Cuando la detección sea ambigua, el sistema debe indicarlo explícitamente y pedir revisión adicional.

Ejemplos de entidades posibles:
- persona / parte;
- inmueble / bien;
- expediente;
- fechas relevantes;
- montos;
- organismos o juzgados.

### 9.4. Revisión del template
El usuario debe poder:
- validar lo detectado por el sistema;
- agregar datos variables faltantes;
- quitar datos mal detectados;
- renombrar datos;
- reorganizar datos dentro de entidades;
- confirmar la estructura final del template.

El sistema debe además poder formular dudas cuando detecte ambigüedad.

Cada dato detectado debe mostrar, al menos de forma básica, de qué fragmento del documento original proviene.

### 9.5. Variaciones condicionales simples
El MVP debe soportar:
- bloques opcionales;
- grupos repetibles simples;
- condiciones sencillas del tipo sí/no.

Ejemplos:
- incluir o no una cláusula;
- agregar uno o más firmantes;
- mostrar una sección solo si existe garante.

No incluye reglas anidadas, múltiples operadores lógicos ni reestructuración completa del documento.

### 9.6. Biblioteca personal de plantillas
El usuario debe poder:
- guardar una plantilla validada;
- ponerle nombre;
- verla dentro de su biblioteca personal;
- reutilizarla para crear nuevos documentos.

Estados mínimos sugeridos para las plantillas del MVP:
- borrador;
- validada;
- archivada.

### 9.7. Generación de formulario para un caso nuevo
Desde una plantilla guardada, el sistema debe generar un formulario para completar los datos particulares del caso.

El formulario debe:
- estar organizado por secciones o entidades;
- mostrar claramente qué datos faltan;
- contemplar campos obligatorios y opcionales;
- permitir bloques repetibles simples.

### 9.8. Generación del documento final
Una vez completo el formulario, el sistema debe redactar el documento final usando:
- la estructura validada del template;
- los datos del caso cargados por el usuario;
- las condiciones simples definidas en la plantilla.

Si faltan datos obligatorios, el sistema no debe generar silenciosamente un documento incompleto.

### 9.9. Edición final antes de descargar
Antes de la descarga, el usuario debe poder:
- revisar el documento final;
- editar cualquier párrafo del contenido;
- corregir redacción puntual si lo desea.

No forma parte del MVP la edición manual avanzada del formato. La edición final permite modificar texto de párrafos existentes, pero no estilos, márgenes, encabezados ni la disposición general del documento.

### 9.10. Exportación
El usuario puede descargar el documento generado en:
- texto plano;
- ODF;
- PDF.

Cuando la salida sea ODF o PDF, el sistema debe intentar conservar el formato del documento original:
- títulos;
- encabezados;
- márgenes;
- orientación;
- líneas;
- figuras;
- estructura visual general.

La promesa del MVP debe entenderse como una preservación razonable de estructura y presentación general en los casos soportados, no como equivalencia visual exacta en todos los documentos.

### 9.11. Acceso, plan y límites visibles
El MVP debe contemplar una experiencia de acceso por suscripción integrada.

El usuario debe poder:
- usar el producto sin configurar API keys externas;
- entender qué incluye su plan;
- visualizar su disponibilidad o consumo de uso en términos comprensibles;
- recibir avisos claros cuando se acerque a un límite.

La comunicación de límites debe evitar jerga técnica y priorizar unidades cercanas al valor del producto.

Los avisos de límite deben aparecer dentro del contexto de trabajo y también en un resumen persistente de uso.

### 9.12. Tratamiento de datos, retención y borrado
El MVP debe explicarle al usuario, en lenguaje simple:
- qué artefactos pueden persistirse dentro del producto (archivo original, texto extraído, plantilla, documento generado, metadatos de uso);
- qué artefactos son temporales y cuáles quedan disponibles en la biblioteca o historial;
- cómo puede eliminar documentos, plantillas y resultados guardados;
- qué expectativas de confidencialidad aplican al uso del servicio.

La política exacta de retención y borrado queda pendiente de definición antes de cerrar mockups finales.

### 9.13. Auditabilidad básica y señales de confianza
El MVP debe contemplar señales mínimas de trazabilidad para el usuario, por ejemplo:
- cuándo se subió un archivo;
- cuándo se guardó una plantilla;
- cuándo se generó un documento;
- si hubo advertencias de baja confianza durante el análisis.

---

## 10. Flujo principal del usuario

### Flujo A — Crear plantilla desde documento existente
1. El usuario ingresa al producto.
2. Elige “Crear plantilla”.
3. Sube un documento existente.
4. El sistema valida si el archivo es apto para el flujo del MVP y comunica si la calidad alcanza.
5. El sistema analiza el archivo y extrae texto + estructura.
6. El sistema propone:
   - template fijo;
   - datos particulares del caso;
   - entidades detectadas;
   - dudas o ambigüedades.
7. El usuario revisa y corrige.
8. Si el análisis tiene baja confianza, el sistema lo marca y obliga a revisión antes de confirmar.
9. El usuario confirma el template.
10. El usuario guarda la plantilla en su biblioteca personal.

### Flujo B — Generar documento nuevo desde plantilla
1. El usuario entra a su biblioteca.
2. Elige una plantilla.
3. El sistema genera un formulario.
4. El usuario completa los datos del caso.
5. El sistema arma el documento.
6. El usuario revisa y edita cualquier párrafo necesario.
7. El usuario descarga el documento final.

### Flujo C — Construir biblioteca desde documentos viejos
1. El usuario sube documentos ya usados históricamente.
2. El sistema propone plantillas reutilizables.
3. El usuario valida y guarda.
4. La biblioteca personal crece con documentos reales ya probados en su práctica.

### Flujo D — Entender disponibilidad de uso
1. El usuario accede al producto con una suscripción activa.
2. Visualiza de forma simple qué incluye su plan y cuánto uso tiene disponible.
3. Si se acerca a un límite, recibe un aviso claro dentro del contexto de trabajo.
4. El aviso no interrumpe innecesariamente el flujo principal, pero le da previsibilidad.

### Flujo E — Primera vez / biblioteca vacía
1. El usuario entra por primera vez y no tiene plantillas guardadas.
2. El producto explica en pocos pasos cómo funciona el flujo.
3. El producto sugiere qué tipo de documento conviene subir para obtener mejores resultados.
4. El usuario puede iniciar la carga con expectativas realistas sobre análisis y revisión.

### Flujo F — Documento no apto o análisis fallido
1. El usuario sube un archivo.
2. El sistema detecta que no puede leerlo con suficiente claridad o no puede estructurarlo de forma confiable.
3. El producto explica el motivo en lenguaje simple.
4. El usuario puede reintentar, subir otro archivo o volver más tarde.

### Flujo G — Límite alcanzado
1. El usuario intenta analizar o generar un documento.
2. El sistema informa que alcanzó el límite del plan.
3. El producto explica de forma simple qué acción quedó bloqueada y qué alternativas tiene.

### Flujo H — Confidencialidad, almacenamiento y borrado
1. Antes o durante la carga, el usuario puede consultar cómo se tratan sus documentos.
2. El producto explica qué puede quedar guardado, qué no y cómo eliminarlo.
3. El usuario puede borrar artefactos guardados sin depender de soporte.

---

## 11. Pantallas sugeridas del MVP

1. **Inicio**
   - Crear plantilla
   - Usar plantilla
   - Plantillas recientes
   - Resumen simple del plan y uso disponible

2. **Subida de documento**
   - Selección de archivo
   - Indicaciones claras
   - Mensaje de revisión humana posterior
   - Criterios de archivo recomendado
   - Aviso simple sobre tratamiento del documento

3. **Análisis del documento**
   - Estado del proceso
   - Explicación simple de lo que se está detectando

4. **Revisión del template**
   - Vista del documento con resaltado de datos variables
   - Panel lateral de entidades y datos detectados
   - Preguntas de validación / ambigüedades
   - Evidencia u origen del dato detectado

5. **Guardar plantilla**
   - Nombre de plantilla
   - Descripción breve opcional

6. **Biblioteca personal**
   - Lista de plantillas guardadas
   - Acciones para usar o revisar
   - Indicador discreto de uso disponible

7. **Formulario del caso**
   - Secciones por entidad
   - Datos obligatorios y opcionales
   - Repetición simple de bloques

8. **Vista previa y edición final**
   - Documento completo
   - Edición de párrafos
   - Descarga final

9. **Resumen de plan y límites**
   - Qué incluye el plan
   - Consumo disponible o usado
   - Avisos de cercanía a límite

10. **Bienvenida / biblioteca vacía**
   - Explicación breve del flujo
   - Qué documento conviene subir primero

11. **Documento no apto / análisis fallido**
   - Motivo en lenguaje simple
   - Reintento o cambio de archivo

12. **Cómo tratamos tus documentos**
   - Qué se guarda
   - Qué se elimina
   - Cómo borrar contenido guardado

13. **Límite alcanzado / estado del plan**
   - Acción bloqueada
   - Uso consumido
   - Alternativas disponibles

---

## 12. Requisitos de experiencia y confianza

### Requisitos críticos
- El producto debe sentirse serio, profesional y claro.
- Debe explicarle al usuario qué detectó y qué necesita validar.
- Debe evitar lenguaje técnico innecesario.
- Debe privilegiar control y trazabilidad por sobre velocidad ciega.
- Debe evitar fricción operativa innecesaria en el acceso al servicio.
- Debe explicar de forma simple cómo se trata la confidencialidad del documento.
- Debe diferenciar entre detección segura y detección dudosa.
- Debe permitir borrar contenido guardado de forma clara.

### Patrones de confianza esperados
- Resaltado de datos detectados.
- Confirmación explícita antes de guardar una plantilla.
- Vista previa antes de descargar.
- Detección de faltantes obligatorios.
- Preguntas de aclaración ante ambigüedades.
- Visibilidad clara del plan y de los límites de uso.
- Evidencia visible del origen de los datos relevantes.
- Mensaje explícito cuando el sistema no está seguro.
- Política simple de almacenamiento y borrado accesible desde el flujo.

### Requisitos de claridad comercial
- El usuario debe entender rápidamente que no necesita integrar servicios externos.
- El producto debe comunicar límites sin intimidar ni sonar técnico.
- La experiencia debe transmitir previsibilidad de costo y uso.

### Requisitos mínimos de privacidad y confianza
- Aislamiento privado por defecto dentro del producto.
- Explicación entendible de cómo se procesan los documentos.
- Expectativas claras de retención y borrado.
- Señales visibles de actividad relevante sobre plantillas y documentos.

---

## 13. Modelo conceptual del dominio

El MVP debe estructurar la información pensando en:

- **Plantilla**
  - estructura fija del documento
  - reglas simples de variación

- **Dato del caso**
  - información variable que completa la plantilla

- **Entidad**
  - agrupación semántica de datos relacionados
  - ejemplos: parte, inmueble, expediente, juzgado, fecha relevante

- **Documento generado**
  - resultado final creado a partir de una plantilla y un conjunto de datos del caso

La interfaz del MVP no mostrará un grafo visual complejo. En su lugar, mostrará una **vista estructurada de entidades y atributos**, más comprensible para el usuario inicial.

---

## 14. Priorización funcional

### Prioridad 1
- detectar correctamente datos variables;
- permitir revisión y corrección humana;
- guardar plantillas reutilizables.

### Prioridad 2
- preservar el formato del original al generar el documento final;
- soportar bloques opcionales y repetibles simples;
- permitir edición final del contenido.

### Prioridad 3
- simplificar progresivamente el formulario sin perder precisión ni control.
- comunicar claramente el modelo de acceso y los límites de uso sin fricción técnica.
- incorporar señales mínimas de confidencialidad, fallback y trazabilidad antes de buscar sofisticación visual.

---

## 15. Métricas de éxito del MVP

### Métricas de adopción
- cantidad de plantillas creadas por usuario;
- porcentaje de usuarios que crean al menos una plantilla reutilizable;
- frecuencia de reutilización de plantillas guardadas.
- porcentaje de usuarios que entienden el modelo de acceso sin asistencia adicional.
- porcentaje de usuarios que entienden qué queda guardado después de subir un documento.

### Métricas de valor
- tiempo percibido ahorrado frente al método manual;
- porcentaje de documentos generados que llegan a descarga;
- cantidad de correcciones manuales necesarias luego de la generación.

### Métricas de negocio
- conversión a suscripción del plan único del MVP;
- porcentaje de usuarios que alcanzan o se acercan a los límites visibles del plan;
- tasa de abandono relacionada con percepción de límites o costo.

### Métricas de confianza
- porcentaje de plantillas aceptadas luego de la primera revisión;
- cantidad de ajustes manuales en la detección de datos variables;
- satisfacción percibida respecto del control sobre el resultado final.

### Métricas de fallback y claridad
- porcentaje de análisis fallidos que terminan en reintento exitoso;
- tasa de abandono luego de un análisis fallido;
- tickets o dudas generadas por confusión de privacidad o confidencialidad.

---

## 16. Riesgos del MVP

1. **Mala detección de datos variables**
   - Riesgo principal del producto.

2. **Confusión entre texto fijo y texto particular del caso**
   - Especialmente en escritos complejos.

3. **Preservación insuficiente del formato**
   - Puede afectar confianza incluso si el contenido es correcto.

4. **Condiciones simples mal interpretadas**
   - Si una cláusula opcional no se comporta como espera el usuario, cae la credibilidad.

5. **Exceso de complejidad en revisión**
   - Si validar la plantilla es más difícil que editar a mano, el producto pierde valor.

6. **Límites percibidos como confusos o injustos**
   - Si el usuario no entiende qué incluye el plan, la propuesta pierde claridad.

7. **Costo percibido desalineado con el posicionamiento accesible**
   - Si la suscripción no se siente simple y razonable, cae la adopción.

8. **Desconfianza por falta de claridad sobre confidencialidad**
   - Si el usuario no entiende qué se guarda o cómo se borra, puede no subir documentos reales.

9. **Desalineación entre formatos reales de trabajo y formatos soportados**
   - Si los formatos del MVP no coinciden con el hábito real del usuario, cae el valor percibido.

10. **Análisis fallidos sin salida clara**
   - Si la baja confianza o la falla no se comunican bien, el producto parece poco honesto.

---

## 17. Supuestos a validar

- Que abogados aceptarán subir documentos ya usados para construir su biblioteca inicial.
- Que la revisión humana obligatoria no será vista como fricción excesiva si mejora precisión.
- Que contratos y escritos judiciales repetitivos constituyen un recorte suficiente y útil para aprender.
- Que la edición final de párrafos alcanza como nivel de control manual en el MVP.
- Que una vista estructurada por entidades aporta claridad sin necesidad de un grafo visual.
- Que un único plan con límites visibles resulta suficientemente simple para el usuario inicial.
- Que ocultar por completo la gestión de API keys reduce fricción sin generar dudas sobre el servicio.
- Que los usuarios subirán documentos sensibles si almacenamiento y borrado están explicados con claridad.
- Que mostrar evidencia del origen de los datos aumenta confianza sin volver pesada la revisión.
- Que los formatos de entrada y salida elegidos coinciden con las herramientas reales de trabajo del usuario.

---

## 18. Roadmap posterior al MVP

Posibles evoluciones futuras:

- biblioteca compartida por estudio o equipo;
- versionado más rico de plantillas;
- lógica condicional más avanzada;
- sugerencias automáticas basadas en plantillas previas;
- vista avanzada de relaciones entre entidades;
- importación y análisis de lotes documentales;
- clasificación automática por tipo de documento;
- planes adicionales o modalidades avanzadas de acceso.

---

## 19. Decisiones cerradas al momento de este PRD

- Idioma principal: **español**.
- Vertical inicial: **abogados que redactan contratos repetitivos**.
- Biblioteca inicial: **personal**.
- Revisión del template: **siempre obligatoria**.
- Variaciones condicionales del MVP: **bloques opcionales y repetibles simples**.
- Edición final: **sí, sobre cualquier párrafo del contenido; no sobre formato**.
- Prioridad de valor: **detección de datos variables > preservación de formato > simplicidad extrema del formulario**.
- Representación de entidades: **lista estructurada en UI, sin grafo visual como feature principal del MVP**.
- Modelo de acceso: **suscripción integrada gestionada por template-ai**.
- API keys del usuario: **no forman parte del MVP**.
- Plan comercial inicial: **un único plan**.
- Comunicación comercial: **límites visibles y lenguaje simple**.
- Posicionamiento: **utilitario accesible**.
- Formatos de entrada v1: **PDF, DOCX, JPG**.
- Formatos de salida v1: **PDF, DOCX**.
- Comportamiento de límite: **bloqueo de análisis/generación nuevos; acceso a biblioteca e historial intacto**.
- Retención por defecto: **conservar mientras existan plantilla/documento asociado; borrado manual disponible**.
- Tratamiento de noaptos: **bloqueo con solicitud de otro archivo**.
- Tratamiento de baja confianza: **revisión reforzada obligatoria**.

### Pendientes de definición antes de mockups finales
*(todas estas decisiones ya están cerradas, ver sección 19)*
- recorte exacto del primer tipo documental a priorizar;
- formato real de entrada y salida a soportar en v1;
- comportamiento exacto al alcanzar el límite del plan;
- política concreta de almacenamiento, retención y borrado;
- tratamiento esperado de documentos no aptos o de baja confianza.

---

## 20. Decisiones operativas adicionales del MVP

### Recorte documental inicial
- **Prioridad**: contratos repetitivos.
- Los escritos judiciales quedan como desarrollo futura según validación del MVP.

### Formatos soportados en v1
- **Entrada**: PDF, DOCX, JPG.
- **Salida**: PDF, DOCX.
- ODF queda fuera del MVP por ahora.

### Comportamiento ante límite alcanzado
- El bloqueo afecta solo a nuevas análisis y generaciones.
- El usuario puede seguir viendo plantillas existentes, historial y bibliografía.
- Puede descargar documentos ya generados.

### Política de retención y borrado
- Los archivos originales se conservan por defecto mientras existan la plantilla o documento asociado.
- Los documentos generados se guardan en historial reciente.
- El usuario puede borrar manualmente:
  - solo archivo original;
  - plantilla;
  - documento generado;
  - todo lo asociado.

### Tratamiento de documentos noaptos y baja confianza
- **Documento noaptos**: bloqueo total con pedido de otro archivo.
- **Baja confianza en análisis**: se permite continuar solo con revisión reforzada.
- El sistema debe indicar explícitamente cuándo la confianza es baja y marcar los datos dudosos.
