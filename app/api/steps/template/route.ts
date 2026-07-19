import ExcelJS from "exceljs";

export async function GET() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Process Steps");
  worksheet.columns = [
    { header: "Step Name", key: "stepName", width: 30 },
    { header: "Handoff Type", key: "handoffType", width: 16 },
    { header: "Cycle Time (hrs)", key: "cycleTimeHours", width: 18 },
    { header: "Cost", key: "cost", width: 12 },
    { header: "Bottleneck", key: "bottleneck", width: 12 },
    { header: "Notes", key: "notes", width: 40 },
  ];
  worksheet.addRow({
    stepName: "Submit requisition",
    handoffType: "Human",
    cycleTimeHours: 4,
    cost: 100,
    bottleneck: "No",
    notes: "Manager reviews and approves the request",
  });
  worksheet.getRow(1).font = { bold: true };

  for (let row = 2; row <= 200; row++) {
    worksheet.getCell(`B${row}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"System,Human,Cross-team,External"'],
    };
    worksheet.getCell(`E${row}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"Yes,No"'],
    };
  }

  const buffer = await workbook.xlsx.writeBuffer();

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="process-steps-template.xlsx"',
    },
  });
}
