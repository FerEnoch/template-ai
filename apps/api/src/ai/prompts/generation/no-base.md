# Tarea: generación de documento legal (sin texto base)

Generá un documento legal mexicano formal a partir de las entidades extraídas y los datos del formulario.

## Entidades extraídas

{{entities}}

## Datos del formulario

{{formData}}

## Instrucciones

1. Usá un tono y estilo formal de derecho mexicano (es-MX).
2. Estructurá el documento con las secciones típicas de un documento legal:
   - Encabezado o título.
   - Datos de las partes.
   - Antecedentes u objeto.
   - Cláusulas numeradas.
   - Disposiciones finales.
   - Lugar, fecha y firmas.
3. Completá los datos con la información de las entidades y del formulario.
4. Si un dato obligatorio no está disponible, usá el marcador exacto `[COMPLETAR]` en su lugar.
5. Al final del documento, agregá una nota al pie por cada `[COMPLETAR]` indicando el campo faltante, por ejemplo:
   - "※ [COMPLETAR]: Monto de renta no especificado en el documento origen."
6. No inventes cláusulas, partes ni hechos que no estén en los datos proporcionados.

## Formato de salida

Respondé ÚNICAMENTE con un objeto JSON:

```json
{
  "generatedText": "string"
}
```

- `generatedText`: el documento completo en texto plano, con marcadores `[COMPLETAR]` donde corresponda.
