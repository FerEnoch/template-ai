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

## Formato de salida

Respondé ÚNICAMENTE con un objeto JSON:

```json
{
  "group": "string"
}
```

- `group`: uno de los grupos permitidos, GENERAL u OTROS.
