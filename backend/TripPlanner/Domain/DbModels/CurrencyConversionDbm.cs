namespace Domain.DbModels;

public class CurrencyConversionDbm
{
    public int from_currency_id { get; set; }
    public int to_currency_id { get; set; }
    public decimal rate { get; set; }
}
