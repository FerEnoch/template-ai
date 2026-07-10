# Tarea: extracción de entidades

Extraé entidades relevantes del siguiente texto de documento legal mexicano.

## Grupos permitidos

{{groups}}

## Ejemplos de extracción

{{fewShot}}

## Documento

{{documentText}}

## Instrucciones

1. Razoná paso a paso antes de emitir el JSON:
   1. Identificá el tipo de documento (contrato de arrendamiento, compraventa, laboral, mercantil, etc.).
   2. Listá los spans candidatos (nombres, fechas, montos, cláusulas, partes, objetos, etc.).
   3. Clasificá cada span en uno de los grupos permitidos y asigná una confianza.
2. Extraé SOLO datos que aparezcan explícitamente en el documento. No inventes nombres, fechas, montos ni cláusulas.
3. Si un dato es ambiguo o indirecto, asigná confianza BAJA.
4. Si un span no encaja en ningún grupo permitido, descartalo; no lo inventes.

## Criterios de confianza

- **ALTA**: el texto coincide exactamente con una cláusula o frase del documento.
- **MEDIA**: el valor se infiere del contexto con alta certeza (sinónimos claros, formatos equivalentes).
- **BAJA**: el dato es ambiguo, derivado de lenguaje indirecto o requiere interpretación.

## Formato de salida

Respondé ÚNICAMENTE con un objeto JSON que contenga la propiedad `entities`, un arreglo de objetos con esta forma:

```json
{
  "entities": [
    {
      "label": "string",
      "value": "string",
      "group": "string",
      "confidence": "ALTA|MEDIA|BAJA",
      "sourceSpan": "string"
    }
  ]
}
```

- `label`: nombre corto del campo en MAYÚSCULAS (por ejemplo, "ARRENDADOR").
- `value`: texto extraído o inferido.
- `group`: uno de los grupos permitidos listados arriba.
- `confidence`: ALTA, MEDIA o BAJA según los criterios.
- `sourceSpan`: fragmento exacto del documento que respalda la extracción.
