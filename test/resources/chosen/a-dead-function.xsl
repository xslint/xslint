<?xml version="1.0" encoding="UTF-8"?>
<!--
* SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
* SPDX-License-Identifier: MIT
-->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:ex="urn:example" version="2.0" id="dead" exclude-result-prefixes="xs ex">
  <xsl:output encoding="UTF-8" method="html"/>
  <xsl:template match="/">
    <html>
      <xsl:apply-templates/>
    </html>
  </xsl:template>
  <xsl:function name="ex:greeting" as="xs:string">
    <xsl:param name="visitor" as="xs:string"/>
    <xsl:sequence select="'hello'"/>
  </xsl:function>
</xsl:stylesheet>
