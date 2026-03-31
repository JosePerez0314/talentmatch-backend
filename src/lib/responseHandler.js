export const sendResponseOr404 = (res, data, entityName = "Record") => {
    if (!data) {
        return res.status(404).json({
            success: "false",
            error: `${entityName} not found`
        });
    }

    return res.status(200).json({
        succes: true,
        data: data
    });
}