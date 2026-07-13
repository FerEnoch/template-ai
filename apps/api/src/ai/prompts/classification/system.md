# Tarea: clasificación de span

Clasificá el siguiente fragmento (span) en uno de los grupos permitidos.

## Grupos permitidos

{{groups}}

## Span a clasificar

{{span}}

## Contexto del documento

{{context}}

## Instrucciones

1. Analizá el span y el contexto.
2. Elegí el grupo más apropiado de la lista de grupos permitidos.
3. Si el span no encaja claramente en ningún grupo, asigná el grupo **GENERAL**.
4. Si el span es irrelevante o no contiene información útil, asigná el grupo **OTROS**.
5. Asigná un `label` descriptivo del campo en MAYÚSCULAS (por ejemplo, "ARRENDATARIO", "FECHA_FIRMA", "PRECIO_TOTAL").
6. El `value` debe ser el span exacto proporcionado.

## Formato de salida

Respondé ÚNICAMENTE con un objeto JSON:

```json
{
  "label": "string",
  "group": "string",
  "value": "string"
}
```

- `label`: nombre descriptivo del campo en MAYÚSCULAS.
- `group`: uno de los grupos permitidos, GENERAL u OTROS.
- `value`: el span exacto proporcionado.
