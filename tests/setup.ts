import { plugin } from "bun";
import mod from "../scripts/mod-plugin";
import tsrx from "../scripts/tsrx-plugin";

// .tsrx-файлы и встроенные моды ("mod:official") можно импортировать в тестах
plugin(tsrx);
plugin(mod);
