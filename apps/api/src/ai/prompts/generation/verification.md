# Tarea: verificación post-generación

Verificá el siguiente documento generado. Esta revisión es de apoyo: no bloquea la descarga, pero debe reportar advertencias claras.

## Documento generado

{{generatedText}}

## Instrucciones

1. Contá la cantidad de marcadores `[COMPLETAR]` presentes.
2. Verificá la integridad estructural:
   - El documento no debe estar vacío.
   - Debe contener al menos un párrafo o cláusula.
3. Si encontrás `[COMPLETAR]`, incluí una advertencia por cada ocurrencia con su posición aproximada.
4. Si el documento está vacío o carece de párrafos, incluí una advertencia de integridad estructural.

## Formato de salida

Respondé ÚNICAMENTE con un objeto JSON:

```json
{
  "passed": true,
  "completarCount": 0,
  "warnings": ["string"]
}
```

- `passed`: `true` si no hay `[COMPLETAR]` y la estructura es válida; de lo contrario, `false`.
- `completarCount`: cantidad total de marcadores `[COMPLETAR]`.
- `warnings`: arreglo de advertencias descriptivas en español.
