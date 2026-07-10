# Tarea: generación de documento legal (con texto base)

Generá un documento legal mexicano formal a partir del texto base, las entidades extraídas y los datos del formulario.

## Entidades extraídas

{{entities}}

## Datos del formulario

{{formData}}

## Texto base

{{baseText}}

## Instrucciones

1. Usá un tono y estilo formal de derecho mexicano (es-MX).
2. Preservá la estructura, párrafos, cláusulas numeradas, firmas y formato del texto base siempre que sea posible.
3. Completá los datos faltantes con la información de las entidades y del formulario.
4. Si un dato es obligatorio y no está disponible, usá el marcador exacto `[COMPLETAR]` en su lugar.
5. Al final del documento, agregá una nota al pie por cada `[COMPLETAR]` indicando el campo faltante, por ejemplo:
   - "※ [COMPLETAR]: Monto de renta no especificado en el documento origen."
6. Resolución de conflictos:
   - Si el formulario y el texto base contienen valores diferentes para el mismo campo, prevalece el valor del formulario.
   - Si el texto base contiene una cláusula explícita y el formulario la contradice, mantené la cláusula explícita y agregá una nota si es necesario.
7. No inventes cláusulas, partes ni hechos que no estén en los datos proporcionados.

## Formato de salida

Respondé ÚNICAMENTE con un objeto JSON:

```json
{
  "generatedText": "string"
}
```

- `generatedText`: el documento completo en texto plano, con marcadores `[COMPLETAR]` donde corresponda.
