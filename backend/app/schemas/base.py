from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """Python fields are snake_case; the wire format is camelCase to match frontend/lib/types.ts."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
