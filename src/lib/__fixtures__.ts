/**
 * Fixtures sintéticos para tests. NO contienen datos reales de ningún usuario:
 * cuenta ficticia `U00001234`, valores redondos y escenarios diseñados para
 * cubrir los casos clave del parser y el motor de reglas.
 */

/**
 * DividendReport.csv con escenarios de 2025:
 * - ENG (España, retención 19 %)
 * - MO (USA, retención 15 % = tope del convenio)
 * - UCB (Bélgica, retención 30 % = excede convenio 15 %)
 * - APLE (USA REIT) con dividendo mixto ordinario + ROC parcial
 * - N2IU (Singapur) con dividendo 100 % ROC
 */
export const DIVIDEND_REPORT_BASIC_2025 = `Account,Header,AccountNumber,AccountAlias,Name,BaseCurrency,
Account,Data,U00001234,test-account,John Example,EUR,
DividendDetail,Header,DataDiscriminator,Currency,Symbol,Conid,Country,ReportDate,ExDate,Shares,RevenueComponent,QualifiedIndicator,Gross,GrossInBase,GrossInUSD,Withhold,WithholdInBase,WithholdInUSD
DividendDetail,Data,Summary,EUR,ENG,123,ES,20250310,20250304,76,,,30.40,30.40,33.10,-5.78,-5.78,-6.30,
DividendDetail,Data,RevenueComponent,EUR,ENG,123,ES,20250310,20250304,,Ordinary Dividend,Qualified - Meets Holding Period,30.40,30.40,33.10,-5.78,-5.78,-6.30,
DividendDetail,Data,Summary,USD,MO,456,US,20250410,20250405,10,,,12.00,10.80,12.00,-1.80,-1.62,-1.80,
DividendDetail,Data,RevenueComponent,USD,MO,456,US,20250410,20250405,,Ordinary Dividend,Qualified - Meets Holding Period,12.00,10.80,12.00,-1.80,-1.62,-1.80,
DividendDetail,Data,Summary,EUR,UCB,789,BE,20250515,20250510,20,,,40.00,40.00,43.60,-12.00,-12.00,-13.08,
DividendDetail,Data,RevenueComponent,EUR,UCB,789,BE,20250515,20250510,,Ordinary Dividend,Qualified - Meets Holding Period,40.00,40.00,43.60,-12.00,-12.00,-13.08,
DividendDetail,Data,Summary,USD,APLE,111,US,20250615,20250610,22,,,5.28,4.75,5.28,-0.71,-0.64,-0.71,
DividendDetail,Data,RevenueComponent,USD,APLE,111,US,20250615,20250610,,Ordinary Dividend,Qualified - Meets Holding Period,4.00,3.60,4.00,-0.60,-0.54,-0.60,
DividendDetail,Data,RevenueComponent,USD,APLE,111,US,20250615,20250610,,Return of Capital,Other,1.28,1.15,1.28,-0.11,-0.10,-0.11,
DividendDetail,Data,Summary,SGD,N2IU,222,SG,20250720,20250715,100,,,50.00,34.00,36.00,0,0,0,
DividendDetail,Data,RevenueComponent,SGD,N2IU,222,SG,20250720,20250715,,Return of Capital,Other,50.00,34.00,36.00,0,0,0,
`

/** DividendReport con un dividendo cobrado en enero 2026 (edge case de caja AEAT). */
export const DIVIDEND_REPORT_OUT_OF_YEAR = `Account,Header,AccountNumber,AccountAlias,Name,BaseCurrency,
Account,Data,U00001234,test-account,John Example,EUR,
DividendDetail,Header,DataDiscriminator,Currency,Symbol,Conid,Country,ReportDate,ExDate,Shares,RevenueComponent,QualifiedIndicator,Gross,GrossInBase,GrossInUSD,Withhold,WithholdInBase,WithholdInUSD
DividendDetail,Data,Summary,EUR,ENG,123,ES,20250310,20250304,76,,,30.40,30.40,33.10,-5.78,-5.78,-6.30,
DividendDetail,Data,RevenueComponent,EUR,ENG,123,ES,20250310,20250304,,Ordinary Dividend,Qualified - Meets Holding Period,30.40,30.40,33.10,-5.78,-5.78,-6.30,
DividendDetail,Data,Summary,EUR,ENG,123,ES,20260115,20251228,76,,,30.40,30.40,33.10,-5.78,-5.78,-6.30,
DividendDetail,Data,RevenueComponent,EUR,ENG,123,ES,20260115,20251228,,Ordinary Dividend,Qualified - Meets Holding Period,30.40,30.40,33.10,-5.78,-5.78,-6.30,
`

/**
 * Activity Statement 2024 con compras de ENG y MO. Se usa junto al
 * ACTIVITY_STATEMENT_WITH_SELLS_2025 para validar el matching FIFO multi-año
 * (compras en año N-1 consumidas por una venta en año N).
 */
export const ACTIVITY_STATEMENT_WITH_BUYS_2024 = `Statement,Header,Nombre del campo,Valor del campo
Statement,Data,BrokerName,Interactive Brokers Ireland Limited
Statement,Data,Title,Informe de actividad
Statement,Data,Period,"Enero 1, 2024 - Diciembre 31, 2024"
Información sobre la cuenta,Header,Nombre del campo,Valor del campo
Información sobre la cuenta,Data,Cuenta,U00001234
Información sobre la cuenta,Data,Divisa base,EUR
Información de instrumento financiero,Header,Categoría de activo,Símbolo,Descripción,Conid,Id. de seguridad,Underlying,Merc. de cotización,Multiplicador,Tipo,Código
Información de instrumento financiero,Data,Acciones,ENG,ENAGAS SA,123,ES0130670112,ENG,BME,1,COMMON,
Información de instrumento financiero,Data,Acciones,MO,ALTRIA GROUP INC,456,US02209S1033,MO,NYSE,1,COMMON,
Operaciones,Header,DataDiscriminator,Categoría de activo,Divisa,Símbolo,Fecha/Hora,Cantidad,Precio trans.,Precio de cier.,Productos,Tarifa/com.,Básico,PyG realizadas,MTM P/G,Código
Operaciones,Data,Order,Acciones,EUR,ENG,"2024-03-10, 10:00:00",100,10.00,10.50,-1000.00,-2.00,1002.00,0,50.00,O
Operaciones,Data,Order,Acciones,EUR,ENG,"2024-09-15, 11:00:00",50,12.00,12.50,-600.00,-1.00,601.00,0,25.00,O
Operaciones,Data,Order,Acciones,EUR,MO,"2024-06-20, 15:00:00",20,40.00,40.50,-800.00,-1.00,801.00,0,10.00,O
`

/**
 * Activity Statement 2025 con escenarios FIFO:
 * - ENG compra adicional y venta parcial → consume parte del lote 2024 antiguo.
 * - MO venta total → consume el lote 2024 completo.
 * - UCB venta SIN compras previas → incomplete basis warning.
 * - APLE compra + venta con pérdida + recompra rápida → flag anti-elusión USA (1 año).
 */
export const ACTIVITY_STATEMENT_WITH_SELLS_2025 = `Statement,Header,Nombre del campo,Valor del campo
Statement,Data,BrokerName,Interactive Brokers Ireland Limited
Statement,Data,Title,Informe de actividad
Statement,Data,Period,"Enero 1, 2025 - Diciembre 31, 2025"
Información sobre la cuenta,Header,Nombre del campo,Valor del campo
Información sobre la cuenta,Data,Cuenta,U00001234
Información sobre la cuenta,Data,Divisa base,EUR
Información de instrumento financiero,Header,Categoría de activo,Símbolo,Descripción,Conid,Id. de seguridad,Underlying,Merc. de cotización,Multiplicador,Tipo,Código
Información de instrumento financiero,Data,Acciones,ENG,ENAGAS SA,123,ES0130670112,ENG,BME,1,COMMON,
Información de instrumento financiero,Data,Acciones,MO,ALTRIA GROUP INC,456,US02209S1033,MO,NYSE,1,COMMON,
Información de instrumento financiero,Data,Acciones,UCB,UCB SA,789,BE0003739530,UCB,EBR,1,COMMON,
Información de instrumento financiero,Data,Acciones,APLE,APPLE HOSPITALITY REIT INC,111,US03784Y2000,APLE,NYSE,1,REIT,
Operaciones,Header,DataDiscriminator,Categoría de activo,Divisa,Símbolo,Fecha/Hora,Cantidad,Precio trans.,Precio de cier.,Productos,Tarifa/com.,Básico,PyG realizadas,MTM P/G,Código
Operaciones,Data,Order,Acciones,EUR,ENG,"2025-02-01, 10:00:00",50,14.00,14.50,-700.00,-1.00,701.00,0,25.00,O
Operaciones,Data,Order,Acciones,EUR,ENG,"2025-05-10, 10:00:00",80,15.00,15.50,1200.00,-1.50,1198.50,150.00,20.00,O
Operaciones,Data,Order,Acciones,EUR,MO,"2025-08-01, 10:00:00",20,50.00,50.50,1000.00,-1.00,999.00,200.00,10.00,O
Operaciones,Data,Order,Acciones,EUR,UCB,"2025-04-15, 10:00:00",10,80.00,80.50,800.00,-1.00,799.00,0,5.00,O
Operaciones,Data,Order,Acciones,EUR,APLE,"2025-03-01, 10:00:00",100,15.00,15.10,-1500.00,-1.00,1501.00,0,10.00,O
Operaciones,Data,Order,Acciones,EUR,APLE,"2025-06-01, 10:00:00",100,13.00,13.10,1300.00,-1.00,1299.00,-202.00,5.00,O
Operaciones,Data,Order,Acciones,EUR,APLE,"2025-07-01, 10:00:00",100,12.50,12.60,-1250.00,-1.00,1251.00,0,5.00,O
`

/**
 * Informe de Actividad que cubre los mismos dividendos del DividendReport básico
 * + trades, fees y movimientos de caja. Los totales "Total … en EUR" cuadran
 * con los del DividendReport (misma base 2025).
 */
export const ACTIVITY_STATEMENT_BASIC_2025 = `Statement,Header,Nombre del campo,Valor del campo
Statement,Data,BrokerName,Interactive Brokers Ireland Limited
Statement,Data,Title,Informe de actividad
Statement,Data,Period,"Enero 1, 2025 - Diciembre 31, 2025"
Información sobre la cuenta,Header,Nombre del campo,Valor del campo
Información sobre la cuenta,Data,Nombre,John Example
Información sobre la cuenta,Data,Cuenta,U00001234
Información sobre la cuenta,Data,Divisa base,EUR
Información de instrumento financiero,Header,Categoría de activo,Símbolo,Descripción,Conid,Id. de seguridad,Underlying,Merc. de cotización,Multiplicador,Tipo,Código
Información de instrumento financiero,Data,Acciones,ENG,ENAGAS SA,123,ES0130670112,ENG,BME,1,COMMON,
Información de instrumento financiero,Data,Acciones,MO,ALTRIA GROUP INC,456,US02209S1033,MO,NYSE,1,COMMON,
Información de instrumento financiero,Data,Acciones,UCB,UCB SA,789,BE0003739530,UCB,EBR,1,COMMON,
Información de instrumento financiero,Data,Acciones,APLE,APPLE HOSPITALITY REIT INC,111,US03784Y2000,APLE,NYSE,1,REIT,
Operaciones,Header,DataDiscriminator,Categoría de activo,Divisa,Símbolo,Fecha/Hora,Cantidad,Precio trans.,Precio de cier.,Productos,Tarifa/com.,Básico,PyG realizadas,MTM P/G,Código
Operaciones,Data,Order,Acciones,EUR,ENG,"2025-02-01, 10:00:00",50,14.00,14.50,-700.00,-1.00,701.00,0,25.00,O
Operaciones,Data,Order,Acciones,USD,MO,"2025-02-15, 15:30:00",10,55.00,55.50,-550.00,-1.00,551.00,0,5.00,O
Tarifas,Header,Subtitle,Divisa,Fecha,Descripción,Cantidad
Tarifas,Data,Otras comisiones,EUR,2025-01-31,Custodian Safekeeping Fee EUR,-2.00
Tarifas,Data,Otras comisiones,USD,2025-03-20,MO Comisión ADR,-0.03
Depósitos y retiradas,Header,Divisa,Fecha de liquidación,Descripción,Cantidad
Depósitos y retiradas,Data,EUR,2025-01-06,Transferencia de Fondos Electrónica,1000
Dividendos,Header,Divisa,Fecha,Descripción,Cantidad
Dividendos,Data,EUR,2025-03-10,ENG(ES0130670112) Dividendo en efectivo EUR 0.40 por acción,30.40
Dividendos,Data,USD,2025-04-10,MO(US02209S1033) Dividendo en efectivo USD 1.20 por acción,12.00
Dividendos,Data,EUR,2025-05-15,UCB(BE0003739530) Dividendo en efectivo EUR 2.00 por acción,40.00
Dividendos,Data,USD,2025-06-15,APLE(US03784Y2000) Dividendo en efectivo USD 0.24 por acción,5.28
Dividendos,Data,SGD,2025-07-20,N2IU Dividendo en efectivo SGD 0.50 por acción,50.00
Dividendos,Data,Total Dividendos en EUR,,,119.95
Retención de impuestos,Header,Divisa,Fecha,Descripción,Cantidad,Código
Retención de impuestos,Data,EUR,2025-03-10,ENG Dividendo - ES Impuestos,-5.78,
Retención de impuestos,Data,USD,2025-04-10,MO Dividendo - US Impuestos,-1.80,
Retención de impuestos,Data,EUR,2025-05-15,UCB Dividendo - BE Impuestos,-12.00,
Retención de impuestos,Data,USD,2025-06-15,APLE Dividendo - US Impuestos,-0.71,
Retención de impuestos,Data,Total Retención de impuestos en EUR,,,-19.40,
`
