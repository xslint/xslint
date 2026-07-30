<?xml version="1.0" encoding="UTF-8"?>
<!--
* SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
* SPDX-License-Identifier: MIT
-->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="2.0" id="count-avt">
  <xsl:template match="/">
    <widget test="count(item) = 0" label="{empty(item)}"/>
  </xsl:template>
</xsl:stylesheet>
